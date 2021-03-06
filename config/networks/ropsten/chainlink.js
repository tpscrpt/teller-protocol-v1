// See more details here: https://docs.chain.link/docs/reference-contracts

module.exports = {
    USDC_ETH: {
        address: '0xB8784d2D77D3dbaa9cAC7d32D035A6d41e414e9c',
        inversed: false,
        collateralDecimals: 18, // ETH
        responseDecimals: 18,
        baseTokenName: 'USDC',
        quoteTokenName: 'ETH',
    },
    DAI_ETH: {
        address: '0x24959556020AE5D39e5bAEC2bd6Bf12420C25aB5',
        inversed: false,
        collateralDecimals: 18, // ETH
        responseDecimals: 18,
        baseTokenName: 'DAI',
        quoteTokenName: 'ETH',
    },
    LINK_DAI: {
        address: '0x40c9885aa8213B40e3E8a0a9aaE69d4fb5915a3A', // Chainlink Pair: LINK - USD
        inversed: true,
        collateralDecimals: 18, // ETH
        responseDecimals: 8,
        baseTokenName: 'LINK',
        quoteTokenName: 'DAI',
    },
    LINK_USDC: {
        address: '0x40c9885aa8213B40e3E8a0a9aaE69d4fb5915a3A', // Chainlink Pair: LINK - USD
        inversed: true,
        collateralDecimals: 18, // ETH
        responseDecimals: 8,
        baseTokenName: 'LINK',
        quoteTokenName: 'USDC',
    },
};