import 'babel-polyfill'
import _ from 'lodash'
import extract from 'extract-zip'
import Excel from 'exceljs'
import fs from 'fs'
import glob from 'glob'
import path from 'path'
import Promise from 'bluebird'
import test from 'tape'
import tempfile from 'tempfile'
import tempWrite from 'temp-write'
import { SphereClient } from 'sphere-node-sdk'
import { randomBytes } from 'crypto'

// eslint-disable-next-line max-len
import ProductTypeExport, { sortAttributes } from '../../src/product-type-export'
import getSphereClientCredentials from '../../src/sphere-client-credentials'

const extractArchive = Promise.promisify(extract)


const random = () => !!Math.round(Math.random())

let PROJECT_KEY

if (process.env.CI === 'true')
  PROJECT_KEY = process.env.SPHERE_PROJECT_KEY
else
  PROJECT_KEY = process.env.npm_config_projectkey

const createProductType = () => ({
  key: randomBytes(8).toString('hex'),
  name: `custom-product-type-${randomBytes(8).toString('hex')}`,
  description: 'Some cool description',
  attributes: [
    random() ? {
      name: 'breite',
      label: {
        de: 'Breite',
        en: 'Width',
      },
      type: {
        name: 'number',
      },
      attributeConstraint: 'None',
      isRequired: false,
      isSearchable: false,
      inputHint: 'SingleLine',
    } : null,
    random() ? {
      name: 'farbe',
      label: {
        de: 'Farbe',
        en: 'Color',
      },
      type: {
        name: 'ltext',
      },
      attributeConstraint: 'None',
      isRequired: false,
      isSearchable: false,
      inputHint: 'SingleLine',
      displayGroup: 'Other',
    } : null,
    {
      name: 'bears',
      label: {
        de: 'Bären',
        en: 'Bears',
      },
      type: {
        name: 'enum',
        values: [{
          key: 'grizzly',
          label: 'Grizzly',
        }, {
          key: 'polar',
          label: 'Polar',
        }, {
          key: 'panda',
          label: 'Panda',
        }, {
          key: 'black',
          label: 'Black',
        }, {
          key: 'sloth',
          label: 'Sloth',
        }, {
          key: 'spectacled',
          label: 'Spectacled',
        }, {
          key: 'asian',
          label: 'Asian',
        }, {
          key: 'ursinae',
          label: 'ursinae',
        }, {
          key: 'short-faced',
          label: 'Short-faced',
        }, {
          key: 'kodiak',
          label: 'Kodiak',
        }, {
          key: 'syrian',
          label: 'Syrian',
        }, {
          key: 'himalayan',
          label: 'Himalayan',
        }],
      },
      attributeConstraint: 'None',
      isRequired: false,
      isSearchable: false,
      displayGroup: 'Other',
    }, {
      name: 'localizedBirds',
      label: {
        de: 'Vögel',
        en: 'Birds',
      },
      type: {
        name: 'lenum',
        values: [{
          key: 'robin',
          label: {
            en: 'Robin redbreast',
            de: 'Rotkehlchen',
          },
        }, {
          key: 'sparrow',
          label: {
            en: 'Sparrow',
            de: 'Spatz',
          },
        }],
      },
      attributeConstraint: 'None',
      isRequired: false,
      isSearchable: false,
      displayGroup: 'Other',
    }, {
      name: 'localizedFlowers',
      label: {
        de: 'Blumen',
        en: 'Flowers',
      },
      type: {
        name: 'set',
        elementType: {
          name: 'lenum',
          values: [{
            key: 'daisy',
            label: {
              en: 'Daisy',
              de: 'Gänseblümchen',
            },
          }, {
            key: 'dandelion',
            label: {
              en: 'Dandelion',
              de: 'Löwenzahn',
            },
          }],
        },
      },
      attributeConstraint: 'None',
      isRequired: false,
      isSearchable: false,
      displayGroup: 'Other',
    },
  ],
})

const deleteAll = (service, client) =>
  client[service].process(({ body: { results } }) =>
    Promise.all(results.map(productType =>
      client[service].byId(productType.id)
        .delete(productType.version)
    ))
  )

let client
let productTypeExport
let sphereClientConfig
const testProductTypes = Array.from(new Array(5), () => createProductType())
const mockProductTypes = testProductTypes.map(type => ({
  ...type, attributes: type.attributes.filter(a => !!a),
}))
const mockAttributes = mockProductTypes.reduce((attributes, type) =>
  [
    ...type.attributes.filter(attr =>
      // filter out already collected attributes
      !attributes.some(existingAttr => existingAttr.name === attr.name)
    ),
    ...attributes,
  ]
, [])

let OUTPUT_FOLDER


const readXlsx = function readXlsx (filePath) {
  const values = []
  const workbook = new Excel.Workbook()
  return workbook.xlsx.readFile(filePath)
    .then(() => {
      const worksheet = workbook.getWorksheet(1)
      worksheet.eachRow((row) => {
        let rowValues = row.values
        rowValues.shift()

        rowValues = rowValues.map(item => (_.isObject(item) ? null : item))
        values.push(rowValues)
      })

      return values
    })
}

const before = function setup () {
  OUTPUT_FOLDER = tempfile()
  fs.mkdirSync(OUTPUT_FOLDER)
  return getSphereClientCredentials(PROJECT_KEY)
    .then((sphereCredentials) => {
      const options = {
        config: sphereCredentials,
      }
      sphereClientConfig = options
      client = new SphereClient(options)

      productTypeExport = new ProductTypeExport({
        sphereClientConfig: options,
        config: {
          outputFolder: OUTPUT_FOLDER,
          exportFormat: 'xlsx',
        },
      })
      return deleteAll('productTypes', client)
        .then(() =>
          Promise.all(mockProductTypes.map(productType =>
            client.productTypes.create(productType)
          ))
        )
    })
}

test(`writeProductTypes to xlsx
  should write product type to attribute mapping xlsx file`, (t) => {
  t.timeoutAfter(15000) // 15s
  before().then(() => {
    const download = tempWrite.sync()
    const destination = tempWrite.sync()
    productTypeExport.downloadProductTypes(download)
      .then(() => productTypeExport.collectAttributes(download))
      .then(({ attributeNames }) => {
        productTypeExport.attributeNames = attributeNames
        return productTypeExport.collectTypesAndAttributes(download)
      })
      .then(({ productTypes }) =>
        productTypeExport.writeProductTypes(productTypes, destination)
      )
      .then(() =>
        readXlsx(destination)
      )
      .then((data) => {
        const attributes = productTypeExport.attributeNames.join(',')
        const header = data[0].join(',')
        t.equal(
          header,
          `name,description,${attributes}`,
          `exported row ${header} is equal`
        )
        t.end()
      })
  })
    .catch(t.end)
})

test(`productType xlsx export module
  should write to attributes with all properties to xlsx file`, (t) => {
  t.timeoutAfter(15000) // 15s
  before().then(() => {
    const download = tempWrite.sync()
    const destination = tempWrite.sync(null, 'output.xlsx')
    productTypeExport.downloadProductTypes(download)
      .then(() => productTypeExport.collectAttributes(download))
      .then(({ attributeNames, attributeKeys }) => {
        productTypeExport.attributeNames = sortAttributes(attributeNames)
        productTypeExport.attributeKeys = sortAttributes(attributeKeys)
        return productTypeExport.collectTypesAndAttributes(download)
      })
      .then(({ attributes }) =>
        productTypeExport.writeAttributes(attributes, destination)
      )
      .then(() =>
        readXlsx(destination)
      )
      .then((data) => {
        const header = data[0]
        const getColIndex = key => header.indexOf(key)
        // check if all the product types have been exported
        productTypeExport.attributeNames.reduce((rowIndex, attrName) => {
          const attrDef = mockAttributes.find(mock => mock.name === attrName)
          const {
            name, type, label, attributeConstraint, inputHint, displayGroup,
            isRequired, isSearchable,
          } = attrDef
          const row = data[rowIndex]
          t.equal(row[0], name, `row ${name} is equal to name`)
          // if the type is a set the element type of the set needs to appended
          const typeName = type.name === 'set' ? `set:${
            type.elementType.name
            }` : type.name
          t.equal(row[1], typeName, `attribute ${typeName} type is equal`)
          // check for all the localizations of the label
          Object.keys(label).forEach((locale) => {
            t.equal(
              row[getColIndex(`label.${locale}`)],
              label[locale],
              `locale ${label[locale]} is equal`
            )
          })
          t.equal(
            row[getColIndex('attributeConstraint')],
            attributeConstraint,
            `attributeConstraint ${attributeConstraint} is equal`
          )
          if (inputHint)
            t.equal(
              row[getColIndex('textInputHint')],
              inputHint,
              `inputHint ${inputHint} is equal`
            )

          if (displayGroup)
            t.equal(
              row[getColIndex('displayGroup')],
              displayGroup,
              `Display Group ${displayGroup} is equal`
            )

          if (isRequired)
            t.equal(
              row[getColIndex('isRequired')],
              isRequired,
              'isRequired flag is equal'
            )

          if (isSearchable)
            t.equal(
              row[getColIndex('isSearchable')],
              isSearchable,
              `isSearchable flag ${isSearchable} is present`
            )

          let additionalRowsForValues = 0
          // check if the type contains multiple values
          if (
            'values' in type ||
            ('elementType' in type && 'values' in type.elementType)
          ) {
            const values = (type.values || type.elementType.values)
            // store the number of rows needed for the current attributes
            // according to the length of the list of values
            additionalRowsForValues = values.length - 1
            values.forEach((attrVal, index) => {
              const valueRow = data[rowIndex + index]
              // check for the enum key
              t.equal(
                valueRow[getColIndex('enumKey')],
                attrVal.key,
                `enumKey ${attrVal.key} is equal`,
              )
              // check for enum label
              if (typeof attrVal.label === 'object')
                return Object.keys(attrVal.label).forEach((locale) => {
                  t.equal(
                    valueRow[getColIndex(`enumLabel.${locale}`)],
                    attrVal.label[locale],
                    `enumLabel ${attrVal.label[locale]} is equal`,
                  )
                })

              return t.equal(
                valueRow[getColIndex('enumLabel')],
                attrVal.label,
                `enumLabel ${attrVal.label} is present`,
              )
            })
          }
          return rowIndex + additionalRowsForValues + 1
        }, 1 /* start at 1 to skip the header row */)
        t.end()
      })
  })
    .catch(t.end)
})

test(`productType export module
  should output a product types and an attributes file`, (t) => {
  t.timeoutAfter(15000) // 15s
  before().then(() => {
    productTypeExport.run()
      .then(() => {
        glob(path.join(OUTPUT_FOLDER, '*'), (err, files) => {
          const expectedFileName1 = 'attributes.xlsx'
          const expectedFileName2 = 'products-to-attributes.xlsx'
          t.equal(files.length, 2, 'files length is 2')
          t.equal(
            path.parse(files[0]).base,
            expectedFileName1,
            `file name is ${expectedFileName1}`,
          )
          t.equal(
            path.parse(files[1]).base,
            expectedFileName2,
            `file name is ${expectedFileName2}`,
          )
          t.end()
        })
      })
  })
    .catch(t.end)
})

test(`productType xlsx export module
  should generate a report`, (t) => {
  t.timeoutAfter(15000) // 15s
  before().then(() => {
    productTypeExport.run()
      .then(() => {
        const summary = JSON.parse(productTypeExport.summaryReport())
        t.deepEqual(summary.errors, [], 'there is no error')
        t.deepEqual(
          summary.exported,
          {
            productTypes: testProductTypes.length,
            attributes: mockAttributes.length,
          },
          'Summary report is valid',
        )
        t.end()
      })
  })
    .catch(t.end)
})

test(`productType export module
  should output a zip file`, (t) => {
  t.timeoutAfter(15000) // 15s

  const zipFileName = 'product-types.zip'
  const expectedFileNames = [
    'attributes.csv',
    zipFileName,
    'products-to-attributes.csv',
  ]

  before().then(() => {
    const productTypeExportCompress = new ProductTypeExport({
      sphereClientConfig,
      config: { outputFolder: OUTPUT_FOLDER, compressOutput: true },
    })
    productTypeExportCompress.run()
      .then(() =>
        new Promise(resolve =>
          glob(path.join(OUTPUT_FOLDER, '*'), (err, files) => {
            t.equal(files.length, 1, 'files length is 1')
            t.equal(
              path.parse(files[0]).base,
              zipFileName,
              `File name is ${zipFileName}`
            )
            return resolve()
          })
        )
      )
      .then(() =>
        extractArchive(path.join(OUTPUT_FOLDER, zipFileName),
          { dir: OUTPUT_FOLDER })
      )
      .then(() => {
        const files = fs.readdirSync(OUTPUT_FOLDER)

        t.deepEqual(
          files,
          expectedFileNames,
          'Archive is complete'
        )

        t.end()
      })
  })
    .catch(t.end)
})
