pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

// Libraries
import "@openzeppelin/contracts-ethereum-package/contracts/utils/Address.sol";

// Interfaces
import "../interfaces/LoansInterface.sol";
import "../interfaces/InterestConsensusInterface.sol";
import "../interfaces/LoanTermsConsensusInterface.sol";
import "../interfaces/LendingPoolInterface.sol";
import "../interfaces/LendersInterface.sol";
import "../interfaces/SettingsInterface.sol";
import "../interfaces/MarketFactoryInterface.sol";
import "../providers/chainlink/IChainlinkPairAggregatorRegistry.sol";

// Commons
import "./DynamicProxy.sol";
import "../util/TellerCommon.sol";
import "./TInitializable.sol";

/*****************************************************************************************************/
/**                                             WARNING                                             **/
/**                                  THIS CONTRACT IS UPGRADEABLE!                                  **/
/**  ---------------------------------------------------------------------------------------------  **/
/**  Do NOT change the order of or PREPEND any storage variables to this or new versions of this    **/
/**  contract as this will cause the the storage slots to be overwritten on the proxy contract!!    **/
/**                                                                                                 **/
/**  Visit https://docs.openzeppelin.com/upgrades/2.6/proxies#upgrading-via-the-proxy-pattern for   **/
/**  more information.                                                                              **/
/*****************************************************************************************************/
/**
    @notice This contract offers functions to manage markets.

    @author develop@teller.finance
 */
contract MarketFactory is TInitializable, BaseUpgradeable, MarketFactoryInterface {
    using Address for address;

    /** Constants */

    /** Structs */

    /* State Variables */

    /**
        @notice It defines a market for a given borrowed and collateral tokens.
        @dev It uses the Settings.ETH_ADDRESS constant to represent ETHER.
        @dev Examples:

        address(DAI) => address(ETH) => Market {...}
        address(DAI) => address(LINK) => Market {...}
     */
    mapping(address => mapping(address => TellerCommon.Market)) markets;

    /* Modifiers */

    /**
        @notice It checks whether the platform is paused or not.
        @dev It throws a require error if the platform is used.
     */
    modifier isNotPaused() {
        require(!settings().isPaused(), "PLATFORM_IS_PAUSED");
        _;
    }

    /**
        @notice It checks whether a market exists or not for a given borrowed/collateral tokens.
        @param borrowedToken the borrowed token address.
        @param collateralToken the collateral token address.
        @dev It throws a require error if the market already exists.
     */
    modifier marketNotExist(address borrowedToken, address collateralToken) {
        require(
            !_getMarket(borrowedToken, collateralToken).exists,
            "MARKET_ALREADY_EXIST"
        );
        _;
    }

    /**
        @notice It checks whether a market exists or not for a given borrowed/collateral tokens.
        @param borrowedToken the borrowed token address.
        @param collateralToken the collateral token address.
        @dev It throws a require error if the market doesn't exist.
     */
    modifier marketExist(address borrowedToken, address collateralToken) {
        require(_getMarket(borrowedToken, collateralToken).exists, "MARKET_NOT_EXIST");
        _;
    }

    /** External Functions */

    /**
        @notice It creates a new market for a given TToken and borrowed/collateral tokens.
        @dev It uses the Settings.ETH_ADDRESS to represent the ETHER.
        @param tToken the TToken address.
        @param borrowedToken the borrowed token address.
        @param collateralToken the collateral token address.
     */
    function createMarket(
        address tToken,
        address borrowedToken,
        address collateralToken
    ) external onlyPauser() isNotPaused() isInitialized() {
        _requireCreateMarket(tToken, borrowedToken, collateralToken);
        address owner = msg.sender;

        IChainlinkPairAggregatorRegistry pairAggregatorRegistry = settings()
            .pairAggregatorRegistry();
        address pairAggregator = address(
            pairAggregatorRegistry.getPairAggregator(borrowedToken, collateralToken)
        );
        require(pairAggregator != address(0x0), "ORACLE_NOT_FOUND_FOR_MARKET");

        (
            LendingPoolInterface lendingPoolProxy,
            InterestConsensusInterface interestConsensusProxy,
            LendersInterface lendersProxy,
            LoanTermsConsensusInterface loanTermsConsensusProxy,
            LoansInterface loansProxy
        ) = _createAndInitializeProxies(
            owner,
            tToken,
            borrowedToken,
            collateralToken,
            pairAggregator
        );

        _addMarket(
            borrowedToken,
            collateralToken,
            address(loansProxy),
            address(lendersProxy),
            address(lendingPoolProxy),
            address(loanTermsConsensusProxy),
            address(interestConsensusProxy),
            pairAggregator
        );

        emit NewMarketCreated(
            owner,
            borrowedToken,
            collateralToken,
            address(loansProxy),
            address(lendersProxy),
            address(lendingPoolProxy),
            address(loanTermsConsensusProxy),
            address(interestConsensusProxy),
            address(pairAggregator)
        );
    }

    /**
        @notice It removes a current market for a given borrowed/collateral tokens.
        @param borrowedToken the borrowed token address.
        @param collateralToken the collateral token address.
     */
    function removeMarket(address borrowedToken, address collateralToken)
        external
        onlyPauser()
        isNotPaused()
        isInitialized()
        marketExist(borrowedToken, collateralToken)
    {
        delete markets[borrowedToken][collateralToken];

        emit MarketRemoved(msg.sender, borrowedToken, collateralToken);
    }

    /**
        @notice It gets the current addresses for a given borrowed/collateral token.
        @param borrowedToken the borrowed token address.
        @param collateralToken the collateral token address.
        @return a struct with the contract addresses for the given market.
     */
    function getMarket(address borrowedToken, address collateralToken)
        external
        view
        returns (TellerCommon.Market memory)
    {
        return _getMarket(borrowedToken, collateralToken);
    }

    /**
        @notice It tests whether a market exists or not for a given borrowed/collateral tokens.
        @param borrowedToken the borrowed token address.
        @param collateralToken the collateral token address.
        @return true if the market exists for the given borrowed/collateral tokens. Otherwise it returns false.
     */
    function existMarket(address borrowedToken, address collateralToken)
        external
        view
        returns (bool)
    {
        return _getMarket(borrowedToken, collateralToken).exists;
    }

    /**
        @notice It tests whether a market exists or not for a given borrowed/collateral tokens.
        @param borrowedToken the borrowed token address.
        @param collateralToken the collateral token address.
        @return true if the market doesn't exist for the given borrowed/collateral tokens. Otherwise it returns false.
     */
    function notExistMarket(address borrowedToken, address collateralToken)
        external
        view
        returns (bool)
    {
        return !_getMarket(borrowedToken, collateralToken).exists;
    }

    /**
        @notice It initializes this market factory instance.
        @param settingsAddress the settings contract address.
     */
    function initialize(address settingsAddress) external isNotInitialized() {
        require(settingsAddress.isContract(), "SETTINGS_MUST_BE_A_CONTRACT");

        _initialize();

        _setSettings(settingsAddress);
    }

    /** Internal Functions */

    /**
        @notice It adds a market in the internal mapping.
        @param borrowedToken the borrowed token address.
        @param collateralToken the collateral token address.
        @param loans the new loans contract address.
        @param lenders the new lenders contracct address.
        @param lendingPool the new lending pool contract address.
        @param loanTermsConsensus the new loan terms consensus contract address.
        @param interestConsensus the new interest consensus contract address.
        @param pairAggregator the pair aggregator address for the market.
     */
    function _addMarket(
        address borrowedToken,
        address collateralToken,
        address loans,
        address lenders,
        address lendingPool,
        address loanTermsConsensus,
        address interestConsensus,
        address pairAggregator
    ) internal {
        markets[borrowedToken][collateralToken] = TellerCommon.Market({
            loans: loans,
            lenders: lenders,
            lendingPool: lendingPool,
            loanTermsConsensus: loanTermsConsensus,
            interestConsensus: interestConsensus,
            pairAggregator: pairAggregator,
            exists: true
        });
    }

    /**
        @notice It creates a dynamic proxy instance for a given logic name.
        @dev It is used to create all the market contracts (Lenders, LendingPool, Loans, and others).
     */
    function _createDynamicProxy(bytes32 logicName) internal returns (address) {
        return address(new DynamicProxy(address(settings()), logicName));
    }

    /**
        @notice It gets the current addresses for a given borrowed/collateral token.
        @param borrowedToken the borrowed token address.
        @param collateralToken the collateral token address.
        @return a struct with the contract addresses for the given market.
     */
    function _getMarket(address borrowedToken, address collateralToken)
        internal
        view
        returns (TellerCommon.Market memory)
    {
        return markets[borrowedToken][collateralToken];
    }

    /**
        @notice It validates the TToken, borrowed and collateral token addresses.
        @param tToken the TToken contract address.
        @param borrowedToken the borrowed token address.
        @param collateralToken the collateral token address.
        @dev It throws a require error if any param is invalid.
     */
    function _requireCreateMarket(
        address tToken,
        address borrowedToken,
        address collateralToken
    ) internal view marketNotExist(borrowedToken, collateralToken) {
        require(tToken.isContract(), "TTOKEN_MUST_BE_CONTRACT");
        require(borrowedToken.isContract(), "BORROWED_TOKEN_MUST_BE_CONTRACT");
        require(
            collateralToken == settings().ETH_ADDRESS() || collateralToken.isContract(),
            "COLL_TOKEN_MUST_BE_CONTRACT"
        );
    }

    /**
        @notice It creates and initializes the proxies used for the given tToken, and borrowed/collateral tokens.
        @param owner the owner address (or sender transaction).
        @param tToken the tToken address.
        @param borrowedToken the borrowed token address.
        @param collateralToken the collateral token address.
        @param pairAggregator the pair aggregator address to used in the new market.
     */
    function _createAndInitializeProxies(
        address owner,
        address tToken,
        address borrowedToken,
        address collateralToken,
        address pairAggregator
    )
        internal
        returns (
            LendingPoolInterface lendingPoolProxy,
            InterestConsensusInterface interestConsensusProxy,
            LendersInterface lendersProxy,
            LoanTermsConsensusInterface loanTermsConsensusProxy,
            LoansInterface loansProxy
        )
    {
        // Creating proxies
        (
            lendingPoolProxy,
            interestConsensusProxy,
            lendersProxy,
            loanTermsConsensusProxy,
            loansProxy
        ) = _createProxies(collateralToken);

        // Initializing proxies.
        _initializeProxies(
            owner,
            tToken,
            borrowedToken,
            collateralToken,
            pairAggregator,
            lendingPoolProxy,
            interestConsensusProxy,
            lendersProxy,
            loanTermsConsensusProxy,
            loansProxy
        );
    }

    /**
        @notice Creates the proxies for:
            - LendingPool
            - InterestConsensus
            - Lenders
            - LoanTermsConsensus
        @return the proxy instances.
     */
    function _createProxies(address collateralToken)
        internal
        returns (
            LendingPoolInterface lendingPoolProxy,
            InterestConsensusInterface interestConsensusProxy,
            LendersInterface lendersProxy,
            LoanTermsConsensusInterface loanTermsConsensusProxy,
            LoansInterface loansProxy
        )
    {
        lendingPoolProxy = LendingPoolInterface(
            _createDynamicProxy(
                settings().versionsRegistry().consts().LENDING_POOL_LOGIC_NAME()
            )
        );
        interestConsensusProxy = InterestConsensusInterface(
            _createDynamicProxy(
                settings().versionsRegistry().consts().INTEREST_CONSENSUS_LOGIC_NAME()
            )
        );
        lendersProxy = LendersInterface(
            _createDynamicProxy(
                settings().versionsRegistry().consts().LENDERS_LOGIC_NAME()
            )
        );
        loanTermsConsensusProxy = LoanTermsConsensusInterface(
            _createDynamicProxy(
                settings().versionsRegistry().consts().LOAN_TERMS_CONSENSUS_LOGIC_NAME()
            )
        );
        if (collateralToken == settings().ETH_ADDRESS()) {
            loansProxy = LoansInterface(
                _createDynamicProxy(
                    settings()
                        .versionsRegistry()
                        .consts()
                        .ETHER_COLLATERAL_LOANS_LOGIC_NAME()
                )
            );
        } else {
            loansProxy = LoansInterface(
                _createDynamicProxy(
                    settings()
                        .versionsRegistry()
                        .consts()
                        .TOKEN_COLLATERAL_LOANS_LOGIC_NAME()
                )
            );
        }
    }

    /**
        @notice It initializes all the new proxies.
        @param owner the owner address (or sender transaction).
        @param tToken the tToken address.
        @param borrowedToken the borrowed token address.
        @param collateralToken the collateral token address.
        @param pairAggregator the pair aggregator address to used in the new market.
        @param lendingPoolProxy the new lending pool proxy instance.
        @param interestConsensusProxy the new interest consensus proxy instance.
        @param lendersProxy the new lenders proxy instance.
        @param loanTermsConsensusProxy the new loan terms consensus proxy instance.
        @param loansProxy the new loans proxy instance.
     */
    function _initializeProxies(
        address owner,
        address tToken,
        address borrowedToken,
        address collateralToken,
        address pairAggregator,
        LendingPoolInterface lendingPoolProxy,
        InterestConsensusInterface interestConsensusProxy,
        LendersInterface lendersProxy,
        LoanTermsConsensusInterface loanTermsConsensusProxy,
        LoansInterface loansProxy
    ) internal {
        address cTokenAddress = settings().getAssetSettings(borrowedToken).cTokenAddress;

        // Initializing LendingPool
        lendingPoolProxy.initialize(
            tToken,
            borrowedToken,
            address(lendersProxy),
            address(loansProxy),
            cTokenAddress,
            address(settings())
        );
        // Initializing InterestConsensus
        interestConsensusProxy.initialize(
            owner,
            address(lendersProxy),
            address(settings())
        );
        // Initializing Lenders
        lendersProxy.initialize(
            tToken,
            address(lendingPoolProxy),
            address(interestConsensusProxy),
            address(settings())
        );
        // Initializing LoanTermsConsensus
        loanTermsConsensusProxy.initialize(
            owner,
            address(loansProxy),
            address(settings())
        );

        // Initializing Loans
        loansProxy.initialize(
            pairAggregator,
            address(lendingPoolProxy),
            address(loanTermsConsensusProxy),
            address(settings()),
            collateralToken
        );
    }
}
