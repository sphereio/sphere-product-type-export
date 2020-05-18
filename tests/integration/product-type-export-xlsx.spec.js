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

// eslint-disable-next-line max-len
import ProductTypeExport, { sortAttributes } from '../../src/product-type-export'
import * as utils from '../utils'

const extractArchive = Promise.promisify(extract)
const mockProductTypes = utils.generateTestProductTypes()
const mockAttributes = utils.getMockAttributes(mockProductTypes)

let OUTPUT_FOLDER
let client
let productTypeExport
let sphereClientConfig

const readXlsx = async function readXlsx (filePath) {
  const values = []
  const workbook = new Excel.Workbook()
  await workbook.xlsx.readFile(filePath)
  const worksheet = workbook.getWorksheet(1)
  worksheet.eachRow((row) => {
    let rowValues = row.values
    rowValues.shift()

    rowValues = rowValues.map(item => (_.isObject(item) ? null : item))
    values.push(rowValues)
  })

  return values
}

async function before () {
  sphereClientConfig = {
    config: await utils.getClientConfig(),
  }

  client = await utils.getClient()
  OUTPUT_FOLDER = tempfile()
  fs.mkdirSync(OUTPUT_FOLDER)

  productTypeExport = new ProductTypeExport({
    sphereClientConfig,
    config: {
      outputFolder: OUTPUT_FOLDER,
      exportFormat: 'xlsx',
    },
  })

  await utils.deleteAll('productTypes', client)
  return Promise.map(
    mockProductTypes,
    productType => client.productTypes.create(productType)
  )
}

test(`writeProductTypes to xlsx
  should write product type to attribute mapping xlsx file`, async (t) => {
    t.timeoutAfter(15000) // 15s
    const productTypesFile = tempWrite.sync()
    const destination = tempWrite.sync()

    try {
      await before()
      await productTypeExport.downloadProductTypes(productTypesFile)

      const {
        attributeNames,
      } = await productTypeExport.collectAttributes(productTypesFile)
      productTypeExport.attributeNames = attributeNames

      const {
        productTypes,
      } = await productTypeExport.collectTypesAndAttributes(productTypesFile)
      await productTypeExport.writeProductTypes(productTypes, destination)

      const data = await readXlsx(destination)
      const attributes = productTypeExport.attributeNames.join(',')
      const header = data[0].join(',')
      t.equal(
        header,
        `name,key,description,${attributes}`,
        `exported row ${header} is equal`
      )
      t.end()
    } catch (e) {
      t.end(e)
    }
  })

test(`productType xlsx export module
  should write to attributes with all properties to xlsx file`, async (t) => {
    t.timeoutAfter(15000) // 15s
    const productTypesFile = tempWrite.sync()
    const destination = tempWrite.sync(null, 'output.xlsx')

    try {
      await before()
      await productTypeExport.downloadProductTypes(productTypesFile)
      const {
        attributeNames,
        attributeKeys,
        allAttributeKeys
      } = await productTypeExport.collectAttributes(productTypesFile)

      productTypeExport.attributeNames = sortAttributes(attributeNames)
      productTypeExport.attributeKeys = sortAttributes(attributeKeys)
      productTypeExport.allAttributeKeys = sortAttributes(allAttributeKeys)
      const {
        attributesByProductType,
      } = await productTypeExport.collectTypesAndAttributes(productTypesFile)

      await productTypeExport.writeAttributes(
        attributesByProductType, destination)
      const data = await readXlsx(destination)
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
    } catch (e) {
      t.end(e)
    }
  })

test(`productType export module
  should output a product types and an attributes file`, async (t) => {
    t.timeoutAfter(15000) // 15s
    try {
      await before()
      await productTypeExport.run()
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
    } catch (e) {
      t.end(e)
    }
  })

test(`productType xlsx export module
  should generate a report`, async (t) => {
    t.timeoutAfter(15000) // 15s
    try {
      await before()
      await productTypeExport.run()
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
    } catch (e) {
      t.end(e)
    }
  })

test(`productType export module
  should output a zip file`, async (t) => {
    t.timeoutAfter(15000) // 15s

    const zipFileName = 'product-types.zip'
    const expectedFileNames = [
      'attributes.csv',
      zipFileName,
      'products-to-attributes.csv',
    ]

    try {
      await before()
      const productTypeExportCompress = new ProductTypeExport({
        sphereClientConfig,
        config: { outputFolder: OUTPUT_FOLDER, compressOutput: true },
      })
      await productTypeExportCompress.run()
      await new Promise(resolve =>
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
      await extractArchive(path.join(OUTPUT_FOLDER, zipFileName),
        { dir: OUTPUT_FOLDER })
      const files = fs.readdirSync(OUTPUT_FOLDER)

      t.deepEqual(
        files,
        expectedFileNames,
        'Archive is complete'
      )
      t.end()
    } catch (e) {
      t.end(e)
    }
  })
