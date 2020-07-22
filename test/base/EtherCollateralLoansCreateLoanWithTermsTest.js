// JS Libraries
const withData = require('leche').withData;
const abi = require('ethereumjs-abi')
const {
  t,
  NULL_ADDRESS,
  TERMS_SET,
  THIRTY_DAYS
} = require('../utils/consts');
const { loans } = require('../utils/events');
const { createLoanRequest, createUnsignedLoanResponse } = require('../utils/structs');

// Mock contracts
const Mock = artifacts.require("./mock/util/Mock.sol");

// Smart contracts
const Loans = artifacts.require("./mock/base/EtherCollateralLoansMock.sol");
const Settings = artifacts.require("./base/Settings.sol");
const LoanTermsConsensus = artifacts.require("./base/LoanTermsConsensus.sol");

contract('EtherCollateralLoansCreateLoanWithTermsTest', function (accounts) {
    let instance;
    let loanTermsConsInstance;
    let lendingPoolInstance;
    let loanTermsConsTemplate;
    let processRequestEncoding;
    let oracleInstance;
    let settingsInstance;

    const borrowerAddress = accounts[2]

    let emptyRequest
    let responseOne
    let responseTwo
    let loanRequest
    
    beforeEach('Setup for each test', async () => {
        lendingPoolInstance = await Mock.new();
        oracleInstance = await Mock.new();
        loanTermsConsInstance = await Mock.new();
        settingsInstance = await Settings.new(1, 1, 1, 1, THIRTY_DAYS, 1)
        instance = await Loans.new();
        await instance.initialize(
            oracleInstance.address,
            lendingPoolInstance.address,
            loanTermsConsInstance.address,
            settingsInstance.address
        )
        responseOne = createUnsignedLoanResponse(accounts[3], 0, 1234, 6500, 10000, 3, loanTermsConsInstance.address)
        responseTwo = createUnsignedLoanResponse(accounts[4], 0, 1500, 6000, 10000, 2, loanTermsConsInstance.address)
        loanRequest = createLoanRequest(borrowerAddress, NULL_ADDRESS, 3, 12000, 4, 19, loanTermsConsInstance.address)
        emptyRequest = createLoanRequest(NULL_ADDRESS, NULL_ADDRESS, 0, 0, 0, 0, loanTermsConsInstance.address)

        loanTermsConsTemplate = await LoanTermsConsensus.new()
        processRequestEncoding = loanTermsConsTemplate
            .contract
            .methods
            .processRequest(emptyRequest, [responseOne])
            .encodeABI()
    });

    withData({
        _1_no_msg_value: [3, 0, 0, undefined, false],
        _2_with_msg_value: [17, 500000, 500000, undefined, false],
        _3_msg_value_collateral_param_not_match_1: [17, 0, 500000, 'INCORRECT_ETH_AMOUNT', true],
        _4_msg_value_collateral_param_not_match_2: [17, 500000, 0, 'INCORRECT_ETH_AMOUNT', true],
        _5_msg_value_collateral_param_not_match_3: [17, 200000, 200001, 'INCORRECT_ETH_AMOUNT', true],
    }, function(
        mockLoanIDCounter,
        initialCollateral,
        msgValue,
        expectedErrorMessage,
        mustFail
    ) {    
        it(t('user', 'createLoanWithTerms', 'Should able (or not) to set loan terms.', mustFail), async function() {
            const interestRate = Math.floor((responseOne.interestRate + responseTwo.interestRate) / 2)
            const collateralRatio = Math.floor((responseOne.collateralRatio + responseTwo.collateralRatio) / 2)
            const maxLoanAmount = Math.floor((responseOne.maxLoanAmount + responseTwo.maxLoanAmount) / 2)

            await instance.setLoanIDCounter(mockLoanIDCounter)

            // mock consensus response
            await loanTermsConsInstance.givenMethodReturn(
                processRequestEncoding,
                abi.rawEncode(
                    ['uint256', 'uint256', 'uint256'],
                    [interestRate.toString(), collateralRatio.toString(), maxLoanAmount.toString()]
                )
            )

            const totalBefore = await instance.totalCollateral.call()
            const contractBalBefore = await web3.eth.getBalance(instance.address)

            try {
                // Invocation
                const tx = await instance.createLoanWithTerms(
                    loanRequest,
                    [responseOne, responseTwo],
                    initialCollateral,
                    {
                        from: borrowerAddress,
                        value: msgValue
                    }
                );

                assert(!mustFail, 'It should have failed because data is invalid.');
                assert(tx);

                const txTime = (await web3.eth.getBlock(tx.receipt.blockNumber)).timestamp
                const termsExpiry = txTime + THIRTY_DAYS
                const lastCollateralIn = msgValue == 0 ? 0 : txTime

                const totalAfter = await instance.totalCollateral.call()
                const contractBalAfter = await web3.eth.getBalance(instance.address)

                const loan = await instance.loans.call(mockLoanIDCounter)

                assert.equal(loan['id'].toString(), mockLoanIDCounter)
                assert.equal(loan['loanTerms']['borrower'].toString(), loanRequest.borrower)
                assert.equal(loan['loanTerms']['recipient'].toString(), loanRequest.recipient)
                assert.equal(loan['loanTerms']['interestRate'].toString(), interestRate)
                assert.equal(loan['loanTerms']['collateralRatio'].toString(), collateralRatio)
                assert.equal(loan['loanTerms']['maxLoanAmount'].toString(), maxLoanAmount)
                assert.equal(loan['loanTerms']['duration'].toString(), loanRequest.duration)
                assert.equal(loan['termsExpiry'].toString(), termsExpiry)
                assert.equal(loan['loanStartTime'].toString(), 0)
                assert.equal(loan['collateral'].toString(), msgValue)
                assert.equal(loan['lastCollateralIn'].toString(), lastCollateralIn)
                assert.equal(loan['principalOwed'].toString(), 0)
                assert.equal(loan['interestOwed'].toString(), 0)
                assert.equal(loan['status'].toString(), TERMS_SET)
                assert.equal(loan['liquidated'], false)


                assert.equal(parseInt(totalBefore) + msgValue, parseInt(totalAfter))
                assert.equal(parseInt(contractBalBefore) + msgValue, parseInt(contractBalAfter))

                loans
                    .loanTermsSet(tx)
                    .emitted(
                        mockLoanIDCounter, 
                        loanRequest.borrower,
                        loanRequest.recipient,
                        interestRate,
                        collateralRatio,
                        maxLoanAmount,
                        loanRequest.duration,
                        txTime + THIRTY_DAYS
                    )
            } catch (error) {
                assert(mustFail);
                assert(error);
                assert.equal(error.reason, expectedErrorMessage);
            }
        });
    });
});