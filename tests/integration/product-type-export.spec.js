import 'babel-polyfill'
import _ from 'lodash'
import test from 'tape'
import tempWrite from 'temp-write'
import fs from 'fs'
import glob from 'glob'
import tempfile from 'tempfile'
import path from 'path'
// eslint-disable-next-line max-len
import ProductTypeExport, { sortAttributes } from '../../src/product-type-export'
import * as utils from '../utils'

const mockProductTypes = utils.generateTestProductTypes()
const mockAttributes = utils.getMockAttributes(mockProductTypes)

let client
let productTypeExport
let sphereClientConfig
let mockKeys = []

let OUTPUT_FOLDER

async function before () {
  sphereClientConfig = {
    config: await utils.getClientConfig(),
  }
  OUTPUT_FOLDER = tempfile()
  fs.mkdirSync(OUTPUT_FOLDER)

  client = await utils.getClient()

  productTypeExport = new ProductTypeExport({
    sphereClientConfig,
    config: { outputFolder: OUTPUT_FOLDER },
  })

  mockKeys = _.map(mockProductTypes, 'key')
  return utils.deleteAll('productTypes', client)
    .return(mockProductTypes)
    .map(productType => client.productTypes.create(productType))
}

test(`productType export module
  should download all product types into a file`, (t) => {
    t.timeoutAfter(30000) // 30s

    before().then(() => {
      const downloadFolder = tempWrite.sync()
      productTypeExport.downloadProductTypes(downloadFolder)
        .then(() => {
          // check file
          const file = fs.readFileSync(downloadFolder, { encoding: 'utf8' })
          const productTypes = JSON.parse(file)
          const actualKeys = productTypes.map(({ key }) => key)
          const expectedKeys = mockProductTypes.map(({ key }) => key)
          expectedKeys.forEach((key) => {
            t.ok(
              actualKeys.includes(key),
              `ProductType key '${key}' is present in the file`
            )
          })
          t.end()
        })
    }).catch(t.end)
  })

test(`productType export module
  should download only selected product types into a file`, (t) => {
    t.timeoutAfter(15000) // 15s

    before().then(() => {
      const expectedKeys = mockKeys.slice(0, 2)
      const downloadFolder = tempWrite.sync()

      const productTypeExportCompress = new ProductTypeExport({
        sphereClientConfig,
        config: {
          outputFolder: OUTPUT_FOLDER,
          where: `key IN ("${expectedKeys.join('","')}")`,
        },
      })

      productTypeExportCompress.downloadProductTypes(downloadFolder)
        .then(() => {
          // check file
          const file = fs.readFileSync(downloadFolder, { encoding: 'utf8' })
          const productTypes = JSON.parse(file)
          const actualKeys = _.map(productTypes, 'key')

          t.equal(
            actualKeys.length,
            expectedKeys.length,
            'Correct count of exported ProductTypes'
          )

          expectedKeys.forEach((key) => {
            t.ok(
              actualKeys.includes(key),
              `ProductType key '${key}' is present in the file`
            )
          })
          t.end()
        })
    }).catch(t.end)
  })

test(`productType export module
  should read product types one by one from downloaded file`, (t) => {
    t.timeoutAfter(15000) // 15s
    before().then(() => {
      const downloadFolder = tempWrite.sync()
      productTypeExport.downloadProductTypes(downloadFolder)
        .then(() => productTypeExport.collectTypesAndAttributes(downloadFolder))
        .then(({ productTypes, attributes }) => {
          const actualTypes = []
          const actualAttributes = []
          productTypes.on('data', (data) => {
            actualTypes.push(data)
          })
          attributes.on('data', (data) => {
            actualAttributes.push(data)
          })
          productTypes.on('end', () => {
            attributes.on('end', () => {
              mockProductTypes.forEach((
                { name, key, description, attributes: typeAttrs }
              ) => {
                const expectedType = {
                  name,
                  key,
                  description,
                  attributes: typeAttrs.map(attr => attr.name),
                }
                const actualType = actualTypes.find(type => type.name === name)
                t.ok(actualType, `ProductType '${actualType}' is present`)
                t.deepEqual(
                  actualType,
                  expectedType,
                  `downloaded productTypes ${JSON.stringify(actualType)}
              matches mockProductTypes ${JSON.stringify(actualType)}`
                )
                // all of the types attributes should have been collected
                typeAttrs.forEach((typeAttr) => {
                  const collectedAttribute = actualAttributes.some(
                    attr => attr.name === typeAttr.name
                  )
                  t.ok(
                    collectedAttribute,
                    `attribute ${collectedAttribute} is present`
                  )
                })
              })
              t.end()
            })
          })
        })
    })
      .catch(t.end)
  })
test(`productType export module
  should return all unique attributes in the product types`, (t) => {
    t.timeoutAfter(15000) // 15s
    before().then(() => {
      const downloadFolder = tempWrite.sync()
      productTypeExport.downloadProductTypes(downloadFolder)
        .then(() => productTypeExport.collectAttributes(downloadFolder))
        .then(({ attributeNames, attributeKeys }) => {
          // should have collected all attributes
          mockProductTypes.forEach((type) => {
            type.attributes.forEach((attr) => {
              t.ok(
                attributeNames.includes(attr.name),
                `Attribute name ${attr.name} is present`
              )
            })
          })

          const expectedKeys = [
            'type.elementType.name',
            'type.elementType.values.0.key',
            'type.elementType.values.0.label.de',
            'type.elementType.values.0.label.en',
            'type.elementType.values.1.key',
            'type.elementType.values.1.label.de',
            'type.elementType.values.1.label.en',
            'type.values.0.label.de',
            'type.values.0.label.en',
            'type.values.1.label.de',
            'type.values.1.label.en',
            'name',
            'label.en',
            'label.de',
            'isRequired',
            'type.name',
            'type.values.0.key',
            'type.values.0.label',
            'type.values.1.key',
            'type.values.1.label',
            'type.values.2.key',
            'type.values.2.label',
            'type.values.3.key',
            'type.values.3.label',
            'type.values.4.key',
            'type.values.4.label',
            'type.values.5.key',
            'type.values.5.label',
            'type.values.6.key',
            'type.values.6.label',
            'type.values.7.key',
            'type.values.7.label',
            'type.values.8.key',
            'type.values.8.label',
            'type.values.9.key',
            'type.values.9.label',
            'type.values.10.key',
            'type.values.10.label',
            'type.values.11.key',
            'type.values.11.label',
            'attributeConstraint',
            'isSearchable',
            'inputHint',
            'displayGroup',
          ]
          expectedKeys.forEach((attr) => {
            t.ok(
              attributeKeys.includes(attr),
              `Attribute key ${attr} is present exported downloadProductTypes`
            )
          })
          t.end()
        })
    })
      .catch(t.end)
  })

test(`writeProductTypes
  should write to product type to attribute mapping to file`, (t) => {
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
        .then(() => {
          const file = fs.readFileSync(destination, 'utf-8')
          const attributes = productTypeExport.attributeNames.join(',')
          file.split('\n').forEach((row, i) => {
            if (i === 0)
              t.equal(
                row,
                `name,key,description,${attributes}`,
                `exported row ${row} is equal`
              )
            // only testing the header row, the rest can be unit tested
          })
          t.end()
        })
    })
      .catch(t.end)
  })

test(`productType export module
  should write to attributes with all properties to file`, (t) => {
    t.timeoutAfter(15000) // 15s
    before().then(() => {
      const download = tempWrite.sync()
      const destination = tempWrite.sync(null, 'output.csv')
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
        .then(() => {
          const file = fs.readFileSync(destination, 'utf-8').split('\n')
          const header = file[0].split(',')
          const getColIndex = key => header.indexOf(key)
          const getRow = index => file[index].split(',')
          // check if all the product types have been exported
          productTypeExport.attributeNames.reduce((rowIndex, attrName) => {
            const attrDef = mockAttributes.find(mock => mock.name === attrName)
            const {
              name, type, label, attributeConstraint, inputHint, displayGroup,
              isRequired, isSearchable,
            } = attrDef
            const row = getRow(rowIndex)
            t.equal(row[0], name, `row ${name} is equal to name`)
            // if the type is a set, element type of the set needs to appended
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
                const valueRow = getRow(rowIndex + index)
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
    t.timeoutAfter(25000) // 25s
    before().then(() => {
      productTypeExport.run()
        .then(() => {
          glob(path.join(OUTPUT_FOLDER, '*'), (err, files) => {
            const expectedFileName1 = 'attributes.csv'
            const expectedFileName2 = 'products-to-attributes.csv'
            t.equal(files.length, 2, 'files length is 2')
            t.equal(
              files[0].split('/').pop(),
              expectedFileName1,
              `file name is ${expectedFileName1}`,
            )
            t.equal(
              files[1].split('/').pop(),
              expectedFileName2,
              `file name is ${expectedFileName2}`,
            )
            t.end()
          })
        })
    })
      .catch(t.end)
  })

test(`productType export module
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
              productTypes: mockProductTypes.length,
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
  should list all errors in the report`, (t) => {
    t.timeoutAfter(15000) // 15s
    before().then(() => {
      productTypeExport.downloadProductTypes = () => Promise.reject(
        'some-error'
      )
      productTypeExport.run()
        .then(() => {
          const summary = JSON.parse(productTypeExport.summaryReport())
          t.deepEqual(summary.errors, ['some-error'], 'Error is present')
          t.deepEqual(
            summary.exported,
            {
              productTypes: 0,
              attributes: 0,
            },
            'Summary report is correct'
          )
          t.end()
        })
    })
      .catch(t.end)
  })

test(`productType export module
  should output a zip file`, (t) => {
    t.timeoutAfter(15000) // 15s
    before().then(() => {
      const productTypeExportCompress = new ProductTypeExport({
        sphereClientConfig,
        config: { outputFolder: OUTPUT_FOLDER, compressOutput: true },
      })
      productTypeExportCompress.run()
        .then(() => {
          glob(path.join(OUTPUT_FOLDER, '*'), (err, files) => {
            t.equal(files.length, 1, 'files length is 1')
            t.equal(
              files[0].split('/').pop(),
              'product-types.zip',
              'file name is product-types.zip'
            )
            t.end()
          })
        })
    })
      .catch(t.end)
  })

test(`productType export module
  should export also productTypes which have no key`, async (t) => {
    t.timeoutAfter(30000) // 30s

    const expectedContent = `name,key,description
test-product-type,,Test product type
`

    try {
      await before()
      await utils.deleteAll('productTypes', client)

      const productType = {
        name: 'test-product-type',
        description: 'Test product type',
        attributes: [],
      }

      await client.productTypes.create(productType)
      await productTypeExport.run()

      const filePath = path.join(OUTPUT_FOLDER, 'products-to-attributes.csv')
      const fileContent = fs.readFileSync(filePath, { encoding: 'utf8' })

      t.equal(
        fileContent,
        expectedContent,
        'Exported row should have an empty key'
      )

      t.end()
    } catch (e) {
      t.end(e)
    }
  })
