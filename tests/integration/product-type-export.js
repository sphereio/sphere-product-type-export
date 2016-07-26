import 'babel-polyfill'
import tempWrite from 'temp-write'
import { expect } from 'chai'
import { SphereClient } from 'sphere-node-sdk'
import fs from 'fs'
import { randomBytes } from 'crypto'
import glob from 'glob'
import tempfile from 'tempfile'
import path from 'path'
import ProductTypeExport, { sortAttributes } from '../../src/product-type-export'
import { getSphereClientCredentials } from '../../src/utils'

const random = () => !!Math.round(Math.random())
// const csvRowForType = (type) => {
//   const { name, description, attributes } = type
//   const hasAttributes = attributes.map(a => {
//     if (a) {
//       return 'X'
//     }
//     return ''
//   })
//   const row = [name, description, ...hasAttributes]
//   console.log(attributes, row)
//   return row.join(',')
// }

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

const PROJECT_KEY = 'sphere-node-sdk-dev'
const deleteAll = (service, client) =>
  client[service].process(({ body: { results } }) =>
    Promise.all(results.map((productType) =>
      client[service].byId(productType.id)
      .delete(productType.version)
    ))
  )

describe('productType export module', function integrationTest() {
  this.timeout(15000) // 15s

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

  beforeEach((done) => {
    OUTPUT_FOLDER = tempfile()
    fs.mkdirSync(OUTPUT_FOLDER)
    getSphereClientCredentials(PROJECT_KEY)
    .then(sphereCredentials => {
      const options = {
        config: sphereCredentials,
      }
      sphereClientConfig = options
      client = new SphereClient(options)

      productTypeExport = new ProductTypeExport({
        sphereClientConfig: options,
        config: { outputFolder: OUTPUT_FOLDER },
      })
      deleteAll('productTypes', client)
      .then(() =>
        Promise.all(mockProductTypes.map(productType =>
          client.productTypes.create(productType)
        ))
      )
      .then(() => {
        done()
      })
      .catch(done)
    })
  })

  describe('downloadProductTypes', () => {
    it('should download all product types into a file', (done) => {
      const downloadFolder = tempWrite.sync()
      productTypeExport.downloadProductTypes(downloadFolder)
      .then(() => {
        // check file
        const file = fs.readFileSync(downloadFolder, { encoding: 'utf8' })
        const productTypes = JSON.parse(file)
        const actualKeys = productTypes.map(({ key }) => key)
        const expectedKeys = mockProductTypes.map(({ key }) => key)
        expectedKeys.forEach(key => {
          expect(actualKeys.includes(key)).to.equal(true)
        })
        done()
      })
      .catch(done)
    })
  })

  describe('collectTypesAndAttributes', () => {
    it('should read product types one by one from downloaded file', (done) => {
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
            mockProductTypes.forEach(({ name, description, attributes: typeAttrs }) => {
              const actualType = actualTypes.find(t => t.name === name)
              expect(!!actualType).to.equal(true)
              expect(actualType).to.deep.equal({
                name,
                description,
                attributes: typeAttrs.map(attr => attr.name),
              })
              // all of the types attributes should have been collected
              typeAttrs.forEach(typeAttr => {
                const collectedAttribute = actualAttributes.some(
                  attr => attr.name === typeAttr.name
                )
                expect(collectedAttribute).to.equal(true)
              })
            })
            done()
          })
        })
      })
      .catch(() => {
        done()
      })
    })
  })

  describe('collectAttributes', () => {
    it('should return all unique attributes in the product types', (done) => {
      const downloadFolder = tempWrite.sync()
      productTypeExport.downloadProductTypes(downloadFolder)
      .then(() => productTypeExport.collectAttributes(downloadFolder))
      .then(({ attributeNames, attributeKeys }) => {
        // should have collected all attributes
        mockProductTypes.forEach(type => {
          type.attributes.forEach(attr => {
            expect(attributeNames.includes(attr.name)).to.equal(true)
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
          'attributeConstraint',
          'isSearchable',
          'inputHint',
          'displayGroup',
        ]
        expectedKeys.forEach(attr => expect(attributeKeys.includes(attr)).to.equal(true))
        done()
      })
      .catch(done)
    })

    it('should reject when there is an error', (done) => {
      productTypeExport.collectAttributes()
      .catch(() => {
        done()
      })
    })
  })

  describe('writeProductTypes', () => {
    it('should write to product type to attribute mapping to file', (done) => {
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
        const attributes = productTypeExport.attributeNames.join(';')
        file.split('\n').forEach((row, i) => {
          if (i === 0) {
            expect(row).to.equal(`name;description;${attributes}`)
          }
          // only testing the header row, the rest can be unit tested
        })
        done()
      })
      .catch(done)
    })
  })

  describe('writeAttributes', () => {
    it('should write to attributes with all properties to file', (done) => {
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
        const header = file[0].split(';')
        const getColIndex = (key) => header.indexOf(key)
        const getRow = (index) => file[index].split(';')
        // check if all the product types have been exported
        productTypeExport.attributeNames.reduce((rowIndex, attrName) => {
          const attrDef = mockAttributes.find(mock => mock.name === attrName)
          const {
            name, type, label, attributeConstraint, inputHint, displayGroup,
            isRequired, isSearchable,
          } = attrDef
          const row = getRow(rowIndex)
          expect(row[0]).to.equal(name)
          // if the type is a set the element type of the set needs to appended
          const typeName = type.name === 'set' ? `set:${type.elementType.name}` : type.name
          expect(row[1]).to.equal(typeName)
          // check for all the localizations of the label
          Object.keys(label).forEach(locale => {
            expect(row[getColIndex(`label.${locale}`)]).to.equal(label[locale])
          })
          expect(row[getColIndex('attributeConstraint')]).to.equal(attributeConstraint)
          if (inputHint) {
            expect(row[getColIndex('inputHint')]).to.equal(inputHint)
          }
          if (displayGroup) {
            expect(row[getColIndex('displayGroup')]).to.equal(displayGroup)
          }
          if (isRequired) {
            expect(row[getColIndex('isRequired')]).to.equal(isRequired)
          }
          if (isSearchable) {
            expect(row[getColIndex('isSearchable')]).to.equal(isSearchable)
          }
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
              expect(valueRow[getColIndex('enumKey')]).to.equal(attrVal.key)
              // check for enum label
              if (typeof attrVal.label === 'object') {
                Object.keys(attrVal.label).forEach(locale => {
                  expect(valueRow[getColIndex(`enumLabel.${locale}`)])
                    .to.equal(attrVal.label[locale])
                })
              } else {
                expect(valueRow[getColIndex('enumLabel')]).to.equal(attrVal.label)
              }
            })
          }
          return rowIndex + additionalRowsForValues + 1
        }, 1 /* start at 1 to skip the header row */)
        done()
      })
      .catch(done)
    })
  })

  describe('run', () => {
    it('should output a product types and an attributes file', (done) => {
      productTypeExport.run()
      .then(() => {
        glob(path.join(OUTPUT_FOLDER, '*'), (err, files) => {
          expect(files.length).to.equal(2)
          expect(files[0].split('/').pop()).to.equal('attributes.csv')
          expect(files[1].split('/').pop()).to.equal('products-to-attributes.csv')
          done()
        })
      }).catch(done)
    })
    it('should generate a report', (done) => {
      productTypeExport.run()
      .then(() => {
        const summary = JSON.parse(productTypeExport.summaryReport())
        expect(summary.errors).to.deep.equal([])
        expect(summary.exported).to.deep.equal({
          productTypes: testProductTypes.length,
          attributes: mockAttributes.length,
        })
        done()
      }).catch(done)
    })
    it('should list all errors in the report', (done) => {
      productTypeExport.downloadProductTypes = () => Promise.reject('some-error')
      productTypeExport.run()
      .then(() => {
        const summary = JSON.parse(productTypeExport.summaryReport())
        expect(summary.errors).to.deep.equal(['some-error'])
        expect(summary.exported).to.deep.equal({
          productTypes: 0,
          attributes: 0,
        })
        done()
      }).catch(done)
    })
    it('should output a zip file', (done) => {
      const productTypeExportCompress = new ProductTypeExport({
        sphereClientConfig,
        config: { outputFolder: OUTPUT_FOLDER, compressOutput: true },
      })
      productTypeExportCompress.run()
      .then(() => {
        glob(path.join(OUTPUT_FOLDER, '*'), (err, files) => {
          expect(files.length).to.equal(1)
          expect(files[0].split('/').pop()).to.equal('product-types.zip')
          done()
        })
      }).catch(done)
    })
  })
})
