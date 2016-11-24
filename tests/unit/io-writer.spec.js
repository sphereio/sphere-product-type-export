import _ from 'lodash'
import fs from 'fs'
import test from 'tape'
import Excel from 'exceljs'
import tempWrite from 'temp-write'
import Writer from '../../src/io/writer'

const readXlsx = function readXlsx (filePath) {
  const values = []
  const workbook = new Excel.Workbook()
  return workbook.xlsx.readFile(filePath)
    .then(() => {
      const worksheet = workbook.getWorksheet(1)
      let headerLen = null
      worksheet.eachRow((row) => {
        let rowValues = row.values
        rowValues.shift()

        if (headerLen)
          // older exceljs reader version trims last value
          // if it is an empty string, so we will pad row
          // to header length with empty string
          rowValues = [
            ...rowValues,
            ...Array(headerLen - rowValues.length).fill(''),
          ]
        else
          headerLen = rowValues.length

        rowValues = _.map(rowValues,
          item => (_.isObject(item) || _.isNil(item) ? '' : item))
        values.push(rowValues)
      })
      return values
    })
}

test(`Writer
  should throw an error when outputFile is not specified`, (t) => {
  const expectedRegexp = new RegExp('OutputFile was not specified', 'g')

  const conf = {
    exportFormat: 'csv',
  }

  t.throws(() => new Writer(conf), expectedRegexp,
    'Should throw an error when creating writer object')
  t.end()
})

test(`Writer
  should throw an error when incorrect export format is specified`, (t) => {
  const expectedRegexp = new RegExp('Unsupported file type: unknown,' +
    ' supported formats are xlsx,csv', 'g')

  const conf = {
    outputFile: 'out.csv',
    exportFormat: 'unknown',
  }

  t.throws(() => new Writer(conf), expectedRegexp,
    'Should throw an error when creating writer object')
  t.end()
})

test(`Writer
  should throw an error when incorrect encoding is specified`, (t) => {
  const expectedRegexp = new RegExp('Encoding does not exist: unknown', 'g')

  const conf = {
    outputFile: 'out.csv',
    exportFormat: 'csv',
    encoding: 'unknown',
  }

  t.throws(() => new Writer(conf), expectedRegexp,
    'Should throw an error when creating writer object')
  t.end()
})

test(`Writer
  should return an error when writing fails`, (t) => {
  const filePath = tempWrite.sync()
  const expectedError = 'Mock error'

  const writer = new Writer({
    outputFile: filePath,
    exportFormat: 'csv',
  })

  // mock stringifier
  writer.csv = {
    stringify: (a, b, done) => done(expectedError),
  }

  writer._writeCsvRows('content')
    .then(() => t.end('Should throw an error when stringify fails'))
    .catch((err) => {
      t.equal(err, expectedError, 'Should return a mocked error')
      t.end()
    })
})

test(`Writer
  should write data to csv file`, (t) => {
  const filePath = tempWrite.sync()
  const expectedOutput = ',,,1,1,2,0,-1,str'
  const row = [null, undefined, false, true, 1, 2, 0, -1, 'str']

  const writer = new Writer({
    outputFile: filePath,
    exportFormat: 'csv',
  })

  writer._writeCsvRows([row])
    .then(() => {
      const csv = fs.readFileSync(filePath).toString()
      t.equal(expectedOutput, csv.split('\n')[0], 'Should write csv to file')
      t.end()
    })
})

test(`Writer
  should write data to xlsx file`, (t) => {
  const filePath = tempWrite.sync()
  const header = 'num,num0,num1,num2,string,undefined,null,true,false'
  const expectedOutput = [-1, 0, 1, 2, 'abcd', '', '', 1, '']
  const row = [-1, 0, 1, 2, 'abcd', undefined, null, true, false]

  const writer = new Writer({
    outputFile: filePath,
    exportFormat: 'xlsx',
  })

  writer.setHeader(header.split(','))
    .then(() => writer.write([row]))
    .then(() => writer.flush())
    .then(() => readXlsx(filePath))
    .then((data) => {
      t.equal(data.length, 2, 'Two exported rows')
      t.deepEqual(data[1], expectedOutput, 'Mapped right values')
      t.end()
    })
})

