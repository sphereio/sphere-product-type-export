import 'babel-polyfill'
import test from 'tape'
import { SphereClient } from 'sphere-node-sdk'
import fs from 'fs'
import { randomBytes } from 'crypto'
import glob from 'glob'
import tempfile from 'tempfile'
import path from 'path'
import iconv from 'iconv-lite'

import ProductTypeExport
  from '../../src/product-type-export'
import getSphereClientCredentials
  from '../../src/sphere-client-credentials'

const ENCODING = 'win1250'
let PROJECT_KEY

if (process.env.CI === 'true')
  PROJECT_KEY = process.env.SPHERE_PROJECT_KEY
else
  PROJECT_KEY = process.env.npm_config_projectkey

const createProductType = () => ({
  key: randomBytes(8).toString('hex'),
  name: 'custom-product-type',
  description: 'Some description - žluťoučký kůň úpěl ďábelské ódy',
  attributes: [
    {
      name: 'breite',
      label: {
        de: 'ě=ášéýřéý=čáěéžěížěé',
        en: 'žluťoučký kůň úpěl ďábelské ódy',
      },
      type: {
        name: 'number',
      },
      attributeConstraint: 'None',
      isRequired: false,
      isSearchable: false,
      inputHint: 'SingleLine',
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
const testProductTypes = [createProductType()]
const mockProductTypes = testProductTypes.map(type => ({
  ...type, attributes: type.attributes.filter(a => !!a),
}))

let OUTPUT_FOLDER

const before = function setup () {
  OUTPUT_FOLDER = tempfile()
  fs.mkdirSync(OUTPUT_FOLDER)
  return getSphereClientCredentials(PROJECT_KEY)
    .then((sphereCredentials) => {
      const options = {
        config: sphereCredentials,
      }
      client = new SphereClient(options)

      productTypeExport = new ProductTypeExport({
        sphereClientConfig: options,
        config: {
          outputFolder: OUTPUT_FOLDER,
          encoding: ENCODING,
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

test(`productType export module
  should output a product types and an attributes `
  + `file using a ${ENCODING} encoding`, (t) => {
  t.timeoutAfter(15000) // 15s

  const expectedFileName1 = 'attributes.csv'
  const expectedFileName2 = 'products-to-attributes.csv'

  const expectedResult1 = 'name,type,attributeConstraint,isRequired,' +
    'isSearchable,label.en,label.de,textInputHint,displayGroup\nbreite,' +
    'number,None,,,žluťoučký kůň úpěl ďábelské ódy,ě=ášéýřéý=čáěéžěížěé,' +
    'SingleLine,Other\n'
  const expectedResult2 = 'name,description,breite\ncustom-product-type,' +
    'Some description - žluťoučký kůň úpěl ďábelské ódy,X\n'

  const expectedEncoded1 = 'name,type,attributeConstraint,isRequired,' +
    'isSearchable,label.en,label.de,textInputHint,' +
    'displayGroup\nbreite,number,None,' +
    ',,�lu�ou�k� k�� �p�l ��belsk� �dy,�=�������=����������,SingleLine,Other\n'
  const expectedEncoded2 = 'name,description,breite\ncustom-product-type,' +
    'Some description - �lu�ou�k� k�� �p�l ��belsk� �dy,X\n'

  before().then(() => productTypeExport.run())
  .then(() =>
    new Promise((resolve) => {
      glob(path.join(OUTPUT_FOLDER, '*'), (err, files) => {
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
        resolve()
      })
    })
  )
  .then(() => {
    const fileContent1 = fs.readFileSync(
      path.join(OUTPUT_FOLDER, expectedFileName1))
    const fileContent2 = fs.readFileSync(
      path.join(OUTPUT_FOLDER, expectedFileName2))

    const decoded1 = iconv.decode(fileContent1, ENCODING)
    const decoded2 = iconv.decode(fileContent2, ENCODING)

    t.equal(fileContent1.toString(), expectedEncoded1,
      `Attributes should be encoded in ${ENCODING}`)
    t.equal(fileContent2.toString(), expectedEncoded2,
      `ProductType should be encoded in ${ENCODING}`)

    t.equal(expectedResult1, decoded1,
      'Attributes should decode back to utf8')
    t.equal(expectedResult2, decoded2,
      'ProductType should decode back to utf8')

    t.end()
  })
  .catch(t.end)
})
