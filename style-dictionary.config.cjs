const StyleDictionary = require('style-dictionary');
const { fileHeader } = StyleDictionary.formatHelpers;

const buildNestedObject = (tokens) => {
  return tokens.reduce((acc, token) => {
    let cursor = acc;
    token.path.forEach((segment, index) => {
      if (index === token.path.length - 1) {
        cursor[segment] = token.value;
      } else {
        cursor[segment] = cursor[segment] || {};
        cursor = cursor[segment];
      }
    });
    return acc;
  }, {});
};

StyleDictionary.registerFormat({
  name: 'typescript/tokens',
  formatter: ({ dictionary, file }) => {
    const nested = buildNestedObject(dictionary.allTokens);
    const tokenPaths = dictionary.allTokens
      .map((token) => token.path.join('.'))
      .sort();

    const pathType = tokenPaths.map((path) => `'${path}'`).join(' | ');

    return `/* eslint-disable */\n${fileHeader({ file })}export const tokens = ${JSON.stringify(nested, null, 2)} as const;\n\nexport type Tokens = typeof tokens;\nexport type TokenPath = ${pathType || 'never'};\n\nexport const tokenPaths = [\n${tokenPaths
      .map((path) => `  '${path}'`)
      .join(',\n')}\n] as const;\n\nexport function getTokenValue(path) {\n  const segments = path.split('.');\n  return segments.reduce((result, segment) => (result ? result[segment] : undefined), tokens);\n}\n`;
  },
});

module.exports = {
  source: ['tokens/**/*.json'],
  platforms: {
    css: {
      transforms: ['attribute/cti', 'name/cti/kebab', 'color/css', 'size/px', 'time/seconds', 'content/icon'],
      buildPath: 'styles/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables',
          options: {
            outputReferences: true,
            selector: ':root',
          },
        },
      ],
    },
    ts: {
      transforms: ['attribute/cti', 'name/cti/camel', 'color/hex', 'size/px', 'time/seconds', 'content/icon'],
      buildPath: 'src/shared/theme/',
      files: [
        {
          destination: 'tokens.ts',
          format: 'typescript/tokens',
        },
      ],
    },
  },
};
