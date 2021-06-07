import { SphereClient } from 'sphere-node-sdk'
import _ from 'lodash'
import test from 'tape'
import ProductTypeExport from '../../src'
import getSphereClientCredentials from '../../src/sphere-client-credentials'

let PROJECT_KEY

if (process.env.CI === 'true')
  PROJECT_KEY = process.env.SPHERE_PROJECT_KEY
else
  PROJECT_KEY = process.env.npm_config_projectkey

const options = {
  sphereClientConfig: {
    config: {
      project_key: PROJECT_KEY,
      client_id: process.env.CI === true ?
        process.env.SPHERE_CLIENT_ID : '*********',
      client_secret: process.env.CI === true ?
        process.env.SPHERE_CLIENT_SECRET : '*********',
    },
    rest: {
      config: {},
      GET: (endpoint, callback) => {
        callback(null, { statusCode: 200 }, { results: [] })
      },
      POST: (endpoint, payload, callback) => {
        callback(null, { statusCode: 200 })
      },
      PUT: () => {},
      DELETE: () => (/* endpoint, callback */) => {},
      PAGED: () => (/* endpoint, callback */) => {},
      _preRequest: () => {},
      _doRequest: () => {},
    },
  },
  config: {
    outputFolder: 'sample/folder',
  },
}

test(`getSphereClientCredentials
  should throw an error is projectKey is not defined`, (t) => {
    getSphereClientCredentials(undefined)
      .then(() => {
        t.fail('should not resolve')
        t.end()
      })
      .catch((err) => {
        const expectedMsg = 'Project Key is needed'
        t.ok(err, 'Error should exist')
        t.equal(err.message, expectedMsg, 'Error message should be present')
        t.end()
      })
  })

test(`productType export module
  should be class`, (t) => {
    const expected = 'function'
    const actual = typeof ProductTypeExport

    t.equal(actual, expected, 'productType export module is a function')
    t.end()
  })

test(`productType export module
  should create a sphere client`, (t) => {
    const exporter = new ProductTypeExport(options)
    const expected = SphereClient
    const actual = exporter.client.constructor

    t.equal(
      actual,
      expected,
      'productType export module is an instanceof SphereClient'
    )
    t.end()
  })

test(`productType export module
  summaryReport should return no errors and no exported product-types
    if no product-types were exported`, (t) => {
    const exporter = new ProductTypeExport(options)
    const expected = {
      errors: [],
      exported: {
        productTypes: 0,
        attributes: 0,
      },
    }
    const actual = JSON.parse(exporter.summaryReport())

    t.deepEqual(actual, expected, 'Summary report contains no errors')
    t.end()
  })

test(`productType export module
  should throw an error if the output folder is not given`, (t) => {
    const noConfigOptions = {
      ...options,
      config: undefined,
    }
    const createExporter = () => new ProductTypeExport(noConfigOptions)
    t.throws(createExporter, 'Throws an erorr when no output folder is given')
    t.end()
  })

test(`productType export module
  should use a comma as default delimiter`, (t) => {
    const exporter = new ProductTypeExport(options)

    t.equal(exporter.config.delimiter, ',', 'comma is the default delimiter')

    t.end()
  })

test(`productType export module
  should filter productTypes if where parameter is present`, (t) => {
    const exporter = new ProductTypeExport(_.cloneDeep(options))
    const expectedFilter = 'key IN ("a", "b")'
    const mockClient = {
      condition: '',
      where (params) {
        this.condition = params
      },
    }

    t.equal(exporter.config.where, '',
      'where filter is empty by default')
    exporter.config.where = 'key IN ("a", "b")'

    exporter.client.productTypes = mockClient
    exporter.getProductTypeClient()
    t.equal(mockClient.condition, expectedFilter,
      'productType export has expected filter')

    t.end()
  })

test(`productType export module
  should not filter productTypes if where parameter is not present`, (t) => {
    const exporter = new ProductTypeExport(options)
    const expectedFilter = null
    const mockClient = {
      condition: null,
      where (params) {
        this.condition = params
      },
    }
    exporter.client.productTypes = mockClient
    exporter.getProductTypeClient()
    t.equal(mockClient.condition, expectedFilter,
      'productType export has expected filter')

    t.end()
  })

