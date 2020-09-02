// JS Libraries
const { withData } = require("leche");
const { t, ETH_ADDRESS } = require("../utils/consts");
const LoansBaseInterfaceEncoder = require("../utils/encoders/LoansBaseInterfaceEncoder");
const settingsNames = require("../utils/platformSettingsNames");
const { createMocks } = require("../utils/consts");
const { createTestSettingsInstance } = require("../utils/settings-helper");
const { encodeLoanParameter } = require("../utils/loans");

// Mock contracts
const Mock = artifacts.require("./mock/util/Mock.sol");

// Smart contracts
const Settings = artifacts.require("./base/Settings.sol");
const Escrow = artifacts.require("./mock/base/EscrowMock.sol");

contract("EscrowCalculateTotalValueTest", function(accounts) {
  const loansEncoder = new LoansBaseInterfaceEncoder(web3)

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
    _2_2_tokens_with_collateral_ratio_eth: [ [ 1000, 2000 ], 200, 20, true, 3170 ],
    _3_3_tokens_with_collateral_ratio_eth: [ [ 1000, 2000, 3000 ], 300, 20, true, 6255 ],
    _4_1_tokens_with_zero_collateral_eth: [ [ 1000 ], 0, 0, true, 1000 ],
    _5_2_tokens_with_zero_collateral_eth: [ [ 1000, 2000 ], 0, 0, true, 3000 ],
    _6_3_tokens_with_zero_collateral_eth: [ [ 1000, 2000, 3000 ], 0, 0, true, 6000 ],

    _7_1_tokens_with_collateral_ratio_token: [ [ 1000 ], 100, 20, false, 1100 ],
    _8_2_tokens_with_collateral_ratio_token: [ [ 1000, 2000 ], 200, 20, false, 3200 ],
    _9_3_tokens_with_collateral_ratio_token: [ [ 1000, 2000, 3000 ], 300, 20, false, 6300 ],
    _10_1_tokens_with_zero_collateral_token: [ [ 1000 ], 0, 0, false, 1000 ],
    _11_2_tokens_with_zero_collateral_token: [ [ 1000, 2000 ], 0, 0, false, 3000 ],
    _12_3_tokens_with_zero_collateral_token: [ [ 1000, 2000, 3000 ], 0, 0, false, 6000 ],
  }, function(
    tokenAmounts,
    collateralAmount,
    collateralRatio,
    collateralIsEth,
    expectedValueInEth
  ) {
    it(t("escrow", "calculateTotalValue", "Should be able to calculate its total value of all assets owned.", false), async function() {
      const tokensAddresses = await createMocks(Mock, tokenAmounts.length)
      await instance.externalSetTokens(tokensAddresses)

      const lendingAddress = tokensAddresses[0]
      const collateralAddress = collateralIsEth ? ETH_ADDRESS : (await Mock.new()).address

      const loans = await Mock.new()
      await instance.mockLoans(loans.address)
      await loans.givenMethodReturnAddress(
        loansEncoder.encodeLendingToken(),
        lendingAddress
      )
      await loans.givenMethodReturnAddress(
        loansEncoder.encodeCollateralToken(),
        collateralAddress
      )
      await loans.givenMethodReturn(
        loansEncoder.encodeLoans(),
        encodeLoanParameter(web3, { collateral: collateralAmount, loanTerms: { collateralRatio } })
      )

      for (let i = 0; i < tokensAddresses.length; i++) {
        await instance.mockValueOfIn(tokensAddresses[i], ETH_ADDRESS, tokenAmounts[i])
      }

      if (!collateralIsEth) {
        await instance.mockValueOfIn(collateralAddress, ETH_ADDRESS, collateralAmount)
      }

      const valueInToken = 1234567890
      await instance.mockValueOfIn(ETH_ADDRESS, lendingAddress, valueInToken)

      const value = await instance.calculateTotalValue.call()
      assert.equal(value.valueInEth.toString(), expectedValueInEth.toString())
      assert.equal(value.valueInToken.toString(), valueInToken.toString())
    })
  })
});