pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../../base/Escrow.sol";
import "../../util/TellerCommon.sol";
import "./BaseEscrowDappMock.sol";

contract EscrowMock is Escrow, BaseEscrowDappMock {
    bool private _mockIsOwner;
    bool public _isOwner;
    address public _borrower;
    TellerCommon.LoanStatus public _loanStatus;
    address internal mockedAggregator;

    bool private _mockValueOfIn;

    mapping(address => mapping(address => uint256)) public _valueOfInMapMock;

    function mockIsOwner(bool mockIsAOwner, bool isAOwner) external {
        _mockIsOwner = mockIsAOwner;
        _isOwner = isAOwner;
    }

    function getBorrower() public view returns (address) {
        return _borrower;
    }

    function mockSettings(address settingsAddress) public {
        _setSettings(settingsAddress);
    }

    function mockBorrowerAndStatus(address borrower, TellerCommon.LoanStatus loanStatus) public {
        _borrower = borrower;
        _loanStatus = loanStatus;
    }

    function isOwner() public view returns (bool) {
        if (_mockIsOwner) {
            return _isOwner;
        } else {
            return super.isOwner();
        }
    }

    function externalIsOwner() external onlyOwner() {}

    function testImplementationFunctionMultiply(uint256 num1, uint256 num2) external pure returns (uint256) {
        return num1 * num2;
    }

    function mockLoans(address loansAddress) external {
        loans = LoansInterface(loansAddress);
    }

    function mockValueOfIn(address base, address quote, uint256 value) external {
        _mockValueOfIn = true;
        _valueOfInMapMock[base][quote] = value;
    }

    function externalValueOfIn(address baseAddress, uint256 baseAmount, address quoteAddress) external returns (uint256) {
        return super._valueOfIn(baseAddress, baseAmount, quoteAddress);
    }

    function _valueOfIn(address baseAddress, uint256 baseAmount, address quoteAddress) internal view returns (uint256) {
        if (_mockValueOfIn) {
            return _valueOfInMapMock[baseAddress][quoteAddress];
        } else {
            return Escrow._valueOfIn(baseAddress, baseAmount, quoteAddress);
        }
    }

    function mockGetAggregatorFor(address aggregatorAddress) external {
        mockedAggregator = aggregatorAddress;
    }

    function _getAggregatorFor(address base, address quote) internal view returns (PairAggregatorInterface) {
        if (mockedAggregator != address(0x0)) {
            return PairAggregatorInterface(mockedAggregator);
        } else {
            return super._getAggregatorFor(base, quote);
        }
    }

    function getLoan() public view returns (TellerCommon.Loan memory) {
        return
            TellerCommon.Loan({
                id: 0,
                loanTerms: TellerCommon.LoanTerms({
                    borrower: msg.sender,
                    recipient: address(0x0),
                    interestRate: 0,
                    collateralRatio: 0,
                    maxLoanAmount: 0,
                    duration: 0
                }),
                termsExpiry: 0,
                loanStartTime: 0,
                collateral: 0,
                lastCollateralIn: 0,
                principalOwed: 0,
                interestOwed: 0,
                borrowedAmount: 0,
                escrow: address(0x0),
                status: _loanStatus,
                liquidated: false
            });
    }
}
