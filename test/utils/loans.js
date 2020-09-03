const { toBytes32 } = require("./consts");
const { NULL_ADDRESS, ACTIVE } = require("./consts");

exports.encodeLoanParameter = (web3, {
  id = 1234,
  loanTerms: {
    borrower = NULL_ADDRESS,
    recipient = NULL_ADDRESS,
    interestRate = 1,
    collateralRatio = 1,
    maxLoanAmount = 100000000,
    duration = 7 * 60 * 60
  } = {},
  termsExpiry = 100000,
  loanStartTime = Date.now(),
  collateral = 1000000,
  lastCollateralIn = 0,
  principalOwed = 0,
  interestOwed = 0,
  borrowedAmount = 0,
  escrow = NULL_ADDRESS,
  status = ACTIVE,
  liquidated = false
}) => {
  return web3.eth.abi.encodeParameter({
    Loan: {
      id: "uint256",
      loanTerms: {
        borrower: "address",
        recipient: "address",
        interestRate: "uint256",
        collateralRatio: "uint256",
        maxLoanAmount: "uint256",
        duration: "uint256"
      },
      termsExpiry: "uint256",
      loanStartTime: "uint256",
      collateral: "uint256",
      lastCollateralIn: "uint256",
      principalOwed: "uint256",
      interestOwed: "uint256",
      borrowedAmount: "uint256",
      escrow: "address",
      status: "uint256",
      liquidated: "bool"
    }
  }, {
    id,
    loanTerms: {
      borrower,
      recipient,
      interestRate,
      collateralRatio,
      maxLoanAmount,
      duration
    },
    termsExpiry,
    loanStartTime,
    collateral,
    lastCollateralIn,
    principalOwed,
    interestOwed,
    borrowedAmount,
    escrow,
    status,
    liquidated
  });
};

exports.encodeConsts = (web3) => {
  return web3.eth.abi.encodeParameter({
    SettingsConsts: {
      REQUIRED_SUBMISSIONS_SETTING: "bytes32",
      MAXIMUM_TOLERANCE_SETTING: "bytes32",
      RESPONSE_EXPIRY_LENGTH_SETTING: "bytes32",
      SAFETY_INTERVAL_SETTING: "bytes32",
      TERMS_EXPIRY_TIME_SETTING: "bytes32",
      LIQUIDATE_ETH_PRICE_SETTING: "bytes32",
      MAXIMUM_LOAN_DURATION_SETTING: "bytes32",
      REQUEST_LOAN_TERMS_RATE_LIMIT_SETTING: "bytes32",
      COLLATERAL_BUFFER_SETTING: "bytes32"
    }
  }, {
    REQUIRED_SUBMISSIONS_SETTING: toBytes32(web3, "RequiredSubmissions"),
    MAXIMUM_TOLERANCE_SETTING: toBytes32(web3, "MaximumTolerance"),
    RESPONSE_EXPIRY_LENGTH_SETTING: toBytes32(web3, "ResponseExpiryLength"),
    SAFETY_INTERVAL_SETTING: toBytes32(web3, "SafetyInterval"),
    TERMS_EXPIRY_TIME_SETTING: toBytes32(web3, "TermsExpiryTime"),
    LIQUIDATE_ETH_PRICE_SETTING: toBytes32(web3, "LiquidateEthPrice"),
    MAXIMUM_LOAN_DURATION_SETTING: toBytes32(web3, "MaximumLoanDuration"),
    REQUEST_LOAN_TERMS_RATE_LIMIT_SETTING: toBytes32(web3, "RequestLoanTermsRateLimit"),
    COLLATERAL_BUFFER_SETTING: toBytes32(web3, "CollateralBuffer")
  });
};