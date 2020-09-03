// JS Libraries
const BN = require("bignumber.js");
const { withData } = require("leche");
const { t, ETH_ADDRESS } = require("../utils/consts");
const LoansBaseInterfaceEncoder = require("../utils/encoders/LoansBaseInterfaceEncoder");
const settingsNames = require("../utils/platformSettingsNames");
const { toBytes32 } = require("../utils/consts");
const { createMocks } = require("../utils/consts");
const { createTestSettingsInstance } = require("../utils/settings-helper");
const { encodeLoanParameter, encodeConsts } = require("../utils/loans");

// Mock contracts
const Mock = artifacts.require("./mock/util/Mock.sol");
const DAIMock = artifacts.require("./mock/token/DAIMock.sol");

// Smart contracts
const Settings = artifacts.require("./base/Settings.sol");
const Escrow = artifacts.require("./mock/base/EscrowMock.sol");
const LoansBase = artifacts.require('./base/LoansBase.sol')

contract("EscrowCalculateTotalValueTest", function(accounts) {
  const loansEncoder = new LoansBaseInterfaceEncoder(web3);

  let instance;
  const collateralBuffer = 1500;

  beforeEach(async () => {
    const settings = await createTestSettingsInstance(Settings, { from: accounts[0], Mock }, {
      [settingsNames.CollateralBuffer]: collateralBuffer
    });

    instance = await Escrow.new();
    await instance.externalSetSettings(settings.address);
  });

  withData({
    _1_1_tokens_with_collateral_ratio_eth: [ [ 1000 ], 100, 20, true, 1085 ],
    // _2_2_tokens_with_collateral_ratio_eth: [ [ 1000, 2000 ], 200, 20, true, 3170 ],
    // _3_3_tokens_with_collateral_ratio_eth: [ [ 1000, 2000, 3000 ], 300, 20, true, 6255 ],
    // _4_1_tokens_with_zero_collateral_eth: [ [ 1000 ], 0, 0, true, 1000 ],
    // _5_2_tokens_with_zero_collateral_eth: [ [ 1000, 2000 ], 0, 0, true, 3000 ],
    // _6_3_tokens_with_zero_collateral_eth: [ [ 1000, 2000, 3000 ], 0, 0, true, 6000 ],
    //
    // _7_1_tokens_with_collateral_ratio_token: [ [ 1000 ], 100, 20, false, 1085 ],
    // _8_2_tokens_with_collateral_ratio_token: [ [ 1000, 2000 ], 200, 20, false, 3170 ],
    // _9_3_tokens_with_collateral_ratio_token: [ [ 1000, 2000, 3000 ], 300, 20, false, 6255 ],
    // _10_1_tokens_with_zero_collateral_token: [ [ 1000 ], 0, 0, false, 1000 ],
    // _11_2_tokens_with_zero_collateral_token: [ [ 1000, 2000 ], 0, 0, false, 3000 ],
    // _12_3_tokens_with_zero_collateral_token: [ [ 1000, 2000, 3000 ], 0, 0, false, 6000 ]
  }, function(
    tokenAmounts,
    collateralAmount,
    collateralRatio,
    collateralIsEth,
    expectedValueInEth
  ) {
    it(t("escrow", "calculateTotalValue", "Should be able to calculate its total value of all assets owned.", false), async function() {
      const tokensAddresses = await createMocks(DAIMock, tokenAmounts.length);

      const lendingAddress = tokensAddresses[0];
      const collateralAddress = collateralIsEth ? ETH_ADDRESS : (await Mock.new()).address;

      const loans = await Mock.new();
      await loans.givenMethodReturn(
        loansEncoder.encodeConsts(),
        encodeConsts(web3)
      )
      await loans.givenMethodReturnAddress(
        loansEncoder.encodeLendingToken(),
        lendingAddress
      );
      await loans.givenMethodReturnAddress(
        loansEncoder.encodeCollateralToken(),
        collateralAddress
      );
      await loans.givenMethodReturn(
        loansEncoder.encodeLoans(),
        encodeLoanParameter(web3, { collateral: collateralAmount, loanTerms: { collateralRatio } })
      );

      await instance.externalSetTokens(tokensAddresses);
      await instance.mockLoans(loans.address);

      const loansAddress = await instance.loans.call()
      const loansC = await LoansBase.at(loansAddress)
      const consts = await loansC.consts.call()
      const decoded = web3.eth.abi.decodeParameter({
        SettingsConsts: {
          REQUIRED_SUBMISSIONS_SETTING: "bytes32",
          MAXIMUM_TOLERANCE_SETTING: 'bytes32',
          RESPONSE_EXPIRY_LENGTH_SETTING: 'bytes32',
          SAFETY_INTERVAL_SETTING: 'bytes32',
          TERMS_EXPIRY_TIME_SETTING: 'bytes32',
          LIQUIDATE_ETH_PRICE_SETTING: 'bytes32',
          MAXIMUM_LOAN_DURATION_SETTING: 'bytes32',
          REQUEST_LOAN_TERMS_RATE_LIMIT_SETTING: 'bytes32',
          COLLATERAL_BUFFER_SETTING: "bytes32"
        }
      }, consts)
      console.log(consts, decoded)

      for (let i = 0; i < tokensAddresses.length; i++) {
        await instance.mockValueOfIn(tokensAddresses[i], ETH_ADDRESS, tokenAmounts[i]);
      }

      // mock the calculation of the collateral buffer
      if (!collateralIsEth) {
        const collAmount = new BN(collateralAmount)
        const collateralMinusBuffer = collAmount.minus(collAmount.multipliedBy(collateralBuffer).dividedBy(10000))
        instance.mockValueOfIn(collateralAddress, ETH_ADDRESS, collateralMinusBuffer.toFixed());
      }

      const valueInToken = 1234567890;
      await instance.mockValueOfIn(ETH_ADDRESS, lendingAddress, valueInToken);

      // Invocation
      const value = await instance.calculateTotalValue.call();

      // Assertions
      assert.equal(value.valueInEth.toString(), expectedValueInEth.toString());
      assert.equal(value.valueInToken.toString(), valueInToken.toString());
    });
  });
});
