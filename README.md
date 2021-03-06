[![commercetools logo][commercetools-icon]][commercetools]
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

## Configuration
The configuration object may contain:
- `config`: configuration object that may contain the following options
  - `delimiter`: the delimiter to be used in the csv (_default_: `,`)
  - `outputFolder` (_required_): the folder used to store the exported product types and attributes
  - `exportFormat` (_optional_): output format, supported are `csv`, `xlsx` (_default_: `csv`)
  - `encoding` (_optional_): encoding used when saving data, supported encodings are listed [here](https://github.com/ashtuchkin/iconv-lite/wiki/Supported-Encodings) (_default_: `utf8`)
  - `where` (_optional_): where predicate used to filter exported productTypes. More info [here](http://dev.commercetools.com/http-api.html#predicates)
  - `includeProductTypeInAttributes` (_optional_): flag to be used when all the attibutes need to be exported
- `sphereClientConfig`: see the [sphere-node-sdk docs](http://sphereio.github.io/sphere-node-sdk/) for more information on this

## Usage

This module can be used as a command line tool as well as a node.js module.

### CLI
Before using this module in the command line, install it with a `global` flag.
```sh
npm install sphere-product-type-export -g
```

#### Command
Command accepts following arguments:
- The `--projectKey` or `-p` parameter is required and contains a project key which should be used when exporting productTypes. 
- The `--outputFolder` or `-o` parameter is required and contains a path to an output folder where the output will be saved. 
- The `--accessToken` or `-t` parameter tells module if it should use access token instead of clientId and clientSecret. 
- The `--sphereHost` parameter tells module whether to use a different API URL. 
- The `--sphereProtocol` parameter tells module whether to use a different protocol. 
- The `--where` or `-w` parameter can be used for filtering productTypes before exporting.
- The `--exportFormat` parameter specifies in which format (CSV or XLSX) shoud it save exported productTypes (default is CSV). 
- The `--delimiter` or `-d` parameter specifies what delimiter should be used when exporting to CSV (default is ',').
- The `--compressOutput` or `-c` parameter specifies whether to archive export files after export is done (default is false). 
- The `--encoding` parameter specifies in which encoding should be exported CSV files (default is utf8). 
- The `includeProductTypeInAttributes` flag to be used when all the attibutes need to be exported.

To export all productTypes in the CSV format we can run this command:
```bash
product-type-export -p project-key -o tmp
```

#### Output
```sh
Export successful!
{
  "errors": [],
  "exported": {
    "productTypes": 3,
    "attributes": 18
  }
}
```
In the `tmp` folder there will be created two files `attributes.csv` and `products-to-attributes.csv` which describe exported productTypes.


### JS
If you want more control, you can also use this library directly in JavaScript. To do this you first need to install it:

```sh
npm install sphere-product-type-export --save
```

Then you can use it to export product types like so:

```js
export ProductTypeExport from 'sphere-product-type-export'

const config = {
  sphereClientConfig: {
    config: {
      project_key: <PROJECT_KEY>,
      client_id: '*********',
      client_secret: '*********'
    }
  },
  config: {
    outputFolder: '',
    delimiter: '',       // default: ,
    compressOutput: '',  // default: false
    exportFormat: '',    // default: csv
    encoding: '',        // default: utf8
    where: '',           // default: ''
  }
}
const productTypeExport = ProductTypeExport(config)

productTypeExport.run()
.then(() => {
  // done exporting the productType
  // look at the summary to see errors
  productTypeExport.summary
  // the summary hast the following structure
  // {
  //   errors: [],
  //   exported: [<some-name>],
  //   successfulExports: 1
  // }
})
```

## Contributing
  See [CONTRIBUTING.md](CONTRIBUTING.md) file for info on how to contribute to this library

[commercetools]: https://commercetools.com/
[commercetools-icon]: https://cdn.rawgit.com/commercetools/press-kit/master/PNG/72DPI/CT%20logo%20horizontal%20RGB%2072dpi.png
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
