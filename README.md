# sphere-product-type-export

[![Travis][travis-badge]][travis-url]
[![Codecov][codecov-badge]][codecov-url]
[![npm][npm-lic-badge]][npm-lic-url]
[![semantic-release][semantic-release-badge]][semantic-release-url]
[![Commitizen friendly][commitizen-badge]][commitizen-url]
[![NPM version][npm-image]][npm-url]

A library that helps with exporting [product-types](http://dev.commercetools.com/http-api-projects-productTypes.html) from the [Commercetools Platform](http://www.commercetools.com/).  
This library is built to be used in conjunction with [sphere-node-cli](https://github.com/sphereio/sphere-node-cli).

## Features
- Export product types from your CTP project
- Creates 2 files - product type / attributes matrix and attributes list - that can be used to reimport product types

### Configuration
The configuration object may contain:
- `config`: configuration object that may contain the following options
  - `delimiter`: the delimiter to be used in the csv (_default_: `;`)
  - `outputFolder` (_required_): the folder used to store the exported product types and attributes
- `sphereClientConfig`: see the [sphere-node-sdk docs](http://sphereio.github.io/sphere-node-sdk/) for more information on this

## Direct usage

If you want more control, you can also use this library directly in JavaScript. To do this you first need to install it:
```
npm install sphere-product-type-export --save-dev
```
Then you can use it to export product types like so:
```
export ProductTypeExport from 'sphere-product-type-export'

const productType = {
  name: '<some-name>',
  description: '<some-description>'
}
const config = {
  sphereClientConfig: {
    config: {
      project_key: <PROJECT_KEY>,
      client_id: '*********',
      client_secret: '*********'
    }
  }
}
const productTypeImport = ProductTypeExport(config)

productTypeExport.run()
.then(() => {
  // done exporting the productType
  // look at the summary to see errors
  productTypeImport.summary
  // the summary hast the following structure
  // {
  //   errors: [],
  //   exported: [<some-name>],
  //   successfulExports: 1
  // }
})
```

[travis-badge]: https://img.shields.io/travis/sphereio/sphere-product-type-export.svg?style=flat-square
[travis-url]: https://travis-ci.org/sphereio/sphere-product-type-export

[codecov-badge]: https://img.shields.io/codecov/c/github/sphereio/sphere-product-type-export.svg?style=flat-square
[codecov-url]: https://codecov.io/github/sphereio/sphere-product-type-export

[npm-lic-badge]: https://img.shields.io/npm/l/sphere-product-type-export.svg?style=flat-square
[npm-lic-url]: http://spdx.org/licenses/MIT

[semantic-release-badge]: https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg?style=flat-square
[semantic-release-url]: https://github.com/semantic-release/semantic-release

[commitizen-badge]: https://img.shields.io/badge/commitizen-friendly-brightgreen.svg?style=flat-square
[commitizen-url]: http://commitizen.github.io/cz-cli/

[npm-url]: https://npmjs.org/package/sphere-product-type-export
[npm-image]: http://img.shields.io/npm/v/sphere-product-type-export.svg?style=flat-square
[npm-downloads-image]: https://img.shields.io/npm/dt/sphere-product-type-export.svg?style=flat-square
