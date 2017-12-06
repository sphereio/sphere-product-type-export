import { Readable } from 'stream'
import _ from 'lodash'
import path from 'path'
import { createWriteStream, createReadStream, mkdirSync, existsSync } from 'fs'
import createDebug from 'debug'
import tempWrite from 'temp-write'
import tempfile from 'tempfile'
import JSONStream from 'JSONStream'
import JSZip from 'jszip'
import { SphereClient } from 'sphere-node-sdk'
import Writer from './io/writer'

const debug = createDebug('product-type-export')

const DEFAULT_ATTRIBUTES = [
  'name',
  'type.name',
  'attributeConstraint',
  'isRequired',
  'isSearchable',
]

export const sortAttributes = attributes =>
  attributes.sort((a, b) => {
    if (
      DEFAULT_ATTRIBUTES.indexOf(a) === -1
      && DEFAULT_ATTRIBUTES.indexOf(b) !== -1
    )
      return 1

    if (
      DEFAULT_ATTRIBUTES.indexOf(a) !== -1
      && DEFAULT_ATTRIBUTES.indexOf(b) === -1
    )
      return -1

    if (
      DEFAULT_ATTRIBUTES.indexOf(a) !== -1
      && DEFAULT_ATTRIBUTES.indexOf(b) !== -1
      && DEFAULT_ATTRIBUTES.indexOf(a) < DEFAULT_ATTRIBUTES.indexOf(b)
    )
      return -1

    if (
      DEFAULT_ATTRIBUTES.indexOf(a) !== -1
      && DEFAULT_ATTRIBUTES.indexOf(b) !== -1
      && DEFAULT_ATTRIBUTES.indexOf(a) > DEFAULT_ATTRIBUTES.indexOf(b)
    )
      return 1

    return 0
  })

const filterDuplicates = arr =>
  arr.reduce((acc, val) =>
    acc.concat(!acc.includes(val) ? val : null)
  , []).filter(e => !!e)

const extractKeys = (obj) => {
  const keys = Object.keys(obj).reduce((acc, key) => {
    if (typeof obj[key] === 'object')
      return acc.concat(extractKeys(obj[key]).map(extracted =>
        `${key}.${extracted}`)
      )
    return acc.concat(key)
  }, [])
  return keys
}

const getValueForKey = (obj, key) => {
  const keys = key.split('.')
  if (keys.length > 1) {
    const [firstKey, ...rest] = keys
    // check if we reached a set
    if (firstKey === 'values' && 'elementType' in obj)
      return getValueForKey(obj.elementType, key)

    return obj[firstKey] ? getValueForKey(obj[firstKey], rest.join('.')) : null
  }
  if (key === 'name' && 'elementType' in obj)
    return `set:${getValueForKey(obj.elementType, key)}`

  return obj[key]
}

const numberOfRowsForHeaders = headers =>
  headers.filter(h => h.match(/type.values/))
    .reduce((highest, val) => {
      const regex = /type.values.([0-9]+)/
      const number = parseInt(regex.exec(val)[1], 10)
      return number > highest ? number : highest
    }, 0) + 1

const filterAttributeKeys = keys =>
  filterDuplicates(keys.map(function mapKey (key) {
    if (key.match(/type\.values\.[0-9]+\.key/))
      return 'type.values.i.key'

    if (key.match(/type\.values\.[0-9]+\.label/)) {
      const regex = /type\.values\.[0-9]+\.label(..+)/
      const isLocalized = regex.exec(key)
      if (isLocalized)
        return `type.values.i.label${isLocalized[1]}`

      return 'type.values.i.label'
    }
    // identify sets by checking for elementType
    if (key.match(/type.elementType/)) {
      const regex = /type.elementType(.+)/
      const containedKey = regex.exec(key)[1]
      return mapKey(`type${containedKey}`)
    }
    return key
  }))

const generateAttributeHeader = keys =>
  filterDuplicates(keys.map(function mapKey (key) {
    if (key.match(/type\.values\.[0-9]+\.key/))
      return 'enumKey'

    if (key.match(/type\.values\.[0-9]+\.label/)) {
      const regex = /type\.values\.[0-9]+\.label(..+)/
      const isLocalized = regex.exec(key)
      if (isLocalized)
        return `enumLabel${isLocalized[1]}`

      return 'enumLabel'
    }
    // identify sets by checking for elementType
    if (key.match(/type.elementType/)) {
      const regex = /type.elementType(.+)/
      const containedKey = regex.exec(key)[1]
      return mapKey(`type${containedKey}`)
    }
    if (key.match(/type.name/))
      return 'type'

    if (key.match(/inputHint/))
      return 'textInputHint'

    return key
  }))

export default class ProductTypeExport {

  // config: {
  //   outputFolder: ''
  //   delimiter: ','
  //   compressOutput: false
  // }
  constructor ({ sphereClientConfig, config = {} }) {
    this.client = new SphereClient(sphereClientConfig)
    this.attributeNames = []

    if (!('outputFolder' in config))
      throw new Error(
        'Missing output folder. ' +
        'Please provide a folder to export to using the "outputFolder" option.'
      )

    this.config = _.defaults(config, {
      delimiter: ',',
      compressOutput: false,
      exportFormat: 'csv',
      encoding: 'utf8',
      where: '',
    })

    this.summary = {
      errors: [],
      exported: {
        productTypes: 0,
        attributes: 0,
      },
    }
  }

  summaryReport () {
    return JSON.stringify(this.summary, null, 2)
  }

  run () {
    // first iteration - only collect information about attributes
    // > product type names go into the list of product types
    // > all attribute names go into the list of attributes

    // second iteration - start writing to both files
    // > attribute-to-type:
    //   > row per product type
    //   > add an X for all attributes of the product type
    //     using the previously collected list for col pos
    // > attributes:
    //   > add a line for every attribute that is not already added
    const { config: { outputFolder, compressOutput, exportFormat } } = this
    const downloadFile = tempWrite.sync(null, 'product-types.json')
    const productAttributesFileName = `products-to-attributes.${exportFormat}`
    const attributesFileName = `attributes.${exportFormat}`

    // if the output should be compressed,
    // the csv files should stored in a temp folder
    const outFolder = compressOutput ? tempfile() : outputFolder
    // create folders if they do not exist
    if (!existsSync(outFolder))
      mkdirSync(outFolder)

    return this.downloadProductTypes(downloadFile)
    .then(() => this.collectAttributes(downloadFile))
    .then(({ attributeNames, attributeKeys }) => {
      this.attributeNames = sortAttributes(attributeNames)
      this.attributeKeys = sortAttributes(attributeKeys)
      return this.collectTypesAndAttributes(downloadFile)
    })
    .then(({ productTypes, attributes }) =>
      Promise.all([
        this.writeProductTypes(
          productTypes,
          path.join(outFolder, productAttributesFileName)
        ),
        this.writeAttributes(
          attributes,
          path.join(outFolder, attributesFileName)
        ),
      ])
    )
    .then(() =>
      (compressOutput ? new Promise((resolve, reject) => {
        const zip = new JSZip()
        zip
        .folder('product-type-export')
        .file(
          productAttributesFileName,
          createReadStream(path.join(outFolder, productAttributesFileName)
        ))
        .file(attributesFileName, createReadStream(
          path.join(outFolder, attributesFileName)
        ))
        .generateNodeStream({ streamFiles: true })
        .pipe(createWriteStream(path.join(outputFolder, 'product-types.zip')))
        .on('finish', () => {
          resolve()
        })
        .on('error', reject)
      }) : Promise.resolve())
    )
    .catch((err) => {
      this.summary.errors.push(err)
    })
  }

  getProductTypeClient () {
    const clientEndpoint = this.client.productTypes

    if (this.config.where)
      clientEndpoint.where(this.config.where)

    return clientEndpoint
  }

  downloadProductTypes (file) {
    const writeStream = createWriteStream(file)
    writeStream.write('[')
    let isFirst = true

    return this.getProductTypeClient()
    .process(({
      body: { results: productTypes },
    }) => {
      productTypes.forEach((productType) => {
        if (!isFirst)
          writeStream.write(',\n')

        isFirst = false
        writeStream.write(JSON.stringify(productType))
      })
      return Promise.resolve()
    }).then(() => {
      writeStream.write(']')
      debug('product types downloaded')
      return Promise.resolve()
    })
  }
  // eslint-disable-next-line class-methods-use-this
  collectAttributes (file) {
    return new Promise((resolve, reject) => {
      const attributeNames = []
      let attributeKeys = []
      const readStream = createReadStream(file)
      // pass [true] to get one product type at a time
      const productTypesInputStream = readStream.pipe(JSONStream.parse([true]))
      productTypesInputStream.on('data', (productType) => {
        const { attributes: typeAttributes } = productType
        // collect all attribute names that the product type contains
        typeAttributes.forEach((attr) => {
          if (!attributeNames.includes(attr.name)) {
            // push the name on the local cache to ignore duplicates
            attributeNames.push(attr.name)
            attributeKeys = [
              ...extractKeys(attr).filter(key =>
                !attributeKeys.includes(key)
              ),
              ...attributeKeys,
            ]
          }
        })
      })
      productTypesInputStream.on('end', () => {
        debug('collected %s unique attributes', attributeNames.length)
        resolve({ attributeNames, attributeKeys })
      })
      productTypesInputStream.on('error', reject)
    })
  }

  /*
   * This function reads from the fail containing all product types
   * It returns two streams:
   * - product type to attribute stream
   * - attributes stream
   * @param {String} file containing the product types
   */
  // eslint-disable-next-line class-methods-use-this
  collectTypesAndAttributes (file) {
    const productTypesOutputStream = new Readable()
    const attributesOutputStream = new Readable()
    const attributeNames = []
    const readStream = createReadStream(file)
    // pass [true] to get one product type at a time
    const productTypesInputStream = readStream.pipe(JSONStream.parse([true]))
    productTypesInputStream.on('data', (productType) => {
      const { name, key, description, attributes: typeAttributes } = productType
      // collect all attribute names that the product type contains
      const attrNames = typeAttributes.map((attr) => {
        // push all new attribute names to the store
        if (!attributeNames.includes(attr.name)) {
          attributeNames.push(attr.name)
          // push the attribute on the stream for later processing
          attributesOutputStream.push(JSON.stringify(attr))
        }
        return attr.name
      })
      productTypesOutputStream.push(JSON.stringify({
        name,
        key,
        description,
        attributes: attrNames,
      }))
    })
    productTypesInputStream.on('end', () => {
      productTypesOutputStream.push(null)
      attributesOutputStream.push(null)
    })

    /* eslint-disable no-underscore-dangle */
    productTypesOutputStream._read = function read () {}
    attributesOutputStream._read = function read () {}
    /* eslint-enable no-underscore-dangle */

    return {
      productTypes: productTypesOutputStream.pipe(JSONStream.parse()),
      attributes: attributesOutputStream.pipe(JSONStream.parse()),
    }
  }

  writeProductTypes (stream, destination) {
    return new Promise((resolve, reject) => {
      const writer = new Writer({
        exportFormat: this.config.exportFormat,
        encoding: this.config.encoding,
        csvDelimiter: this.config.delimiter,
        outputFile: destination,
      })

      // write header
      const header = [
        'name',
        'key',
        'description',
        ...this.attributeNames,
      ]
      writer
        .setHeader(header)
        .then(() => {
          stream.on('data', (productType) => {
            const { name, key, description, attributes } = productType
            const enabledAttributes = this.attributeNames.map((attr) => {
              const attributeInType = attributes.includes(attr)
              return attributeInType ? 'X' : ''
            })
            const row = [name, key || '', description, ...enabledAttributes]

            writer
              .write([row])
              .catch(reject)
            this.summary.exported.productTypes += 1
          })

          stream.on('end', () => {
            writer
              .flush()
              .then(resolve)
          })
        })
    })
  }

  writeAttributes (stream, destination) {
    return new Promise((resolve, reject) => {
      const writer = new Writer({
        exportFormat: this.config.exportFormat,
        encoding: this.config.encoding,
        csvDelimiter: this.config.delimiter,
        outputFile: destination,
      })
      const header = generateAttributeHeader(this.attributeKeys)
      const keys = filterAttributeKeys(this.attributeKeys)
      const numberOfRows = numberOfRowsForHeaders(this.attributeKeys)
      const typeWithValuesRegex = /type.values.(.)/
      writer
        .setHeader(header)
        .then(() => {
          stream.on('data', (attribute) => {
            this.summary.exported.attributes += 1
            for (let i = 0; i < numberOfRows; i += 1) {
              const row = keys.map((key) => {
                // return enum fields if we are in the corresponding row
                if (key.match(typeWithValuesRegex)) {
                  const val = getValueForKey(
                    attribute,
                    key.replace(/\.i\./, `.${i}.`)
                  )
                  // only write strings to the csv file
                  // if the value is an object it is a localized label
                  // which will be handled in another
                  // column with a more specific key
                  return typeof val === 'string' ? val : null
                }
                // only return "normal" values in the first row
                // normal being the ones that are not lists like enum values
                if (i === 0)
                  return getValueForKey(attribute, key)

                return null
              })
              const rowIsEmpty = row.filter(r => !!r).length === 0
              if (!rowIsEmpty)
                writer
                  .write([row])
                  .catch(reject)
            }
          })
          stream.on('end', () => {
            writer
              .flush()
              .then(resolve)
          })
        })
    })
  }

}
