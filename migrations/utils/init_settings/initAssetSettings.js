const assert = require('assert');
const {
    toDecimals
} = require('../../../test/utils/consts');

/**
 * We set all assets settings.
 * 
 * @param settingsInstance a Settings contract instance.
 * @param param1 contains the settings we need for the asset.
 * @param param2 contains an ERC20Detailed instance. 
 */
module.exports = async function (
    settingsInstance, {
        assetSettings,
        tokens,
        compound,
        txConfig,
        network,
    }, {
        ERC20
    }
) {
    console.log('Configuring asset settings.')
    for (const tokenName of Object.keys(assetSettings)) {
        const tokenConfig = assetSettings[tokenName];

        const tokenAddress = tokens[tokenName.toUpperCase()];
        assert(tokenAddress, `Token address (${tokenName}) not found (${network}).`);
        const cTokenAddress = compound[tokenConfig.cToken.toUpperCase()];
        assert(cTokenAddress, `cToken address (${tokenConfig.cToken}) not found (${network}).`);

        const tokenInstance = await ERC20.at(tokenAddress);
        const decimals = await tokenInstance.decimals();
        const maxLoanAmountWithDecimals = toDecimals(tokenConfig.maxLoanAmount, decimals);

        console.log(`Configuring asset: ${tokenName} (${tokenAddress}) / ${tokenConfig.cToken} (${cTokenAddress}) / Max Loan Amount: ${tokenConfig.maxLoanAmount} (${decimals} decimals / ${maxLoanAmountWithDecimals.toFixed(0)})`);
        await settingsInstance.createAssetSettings(
            tokenAddress,
            cTokenAddress,
            maxLoanAmountWithDecimals,
            txConfig,
        );
    }
}