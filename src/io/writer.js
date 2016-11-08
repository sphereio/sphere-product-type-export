import _ from 'lodash'
import stringify from 'csv-stringify'
import Promise from 'bluebird'
import iconv from 'iconv-lite'
import Excel from 'exceljs'

const fs = Promise.promisifyAll(require('fs'))

const DEBUG = false
const debugLog = DEBUG ? console.log : _.noop

export default class Writer {
  constructor (options) {
    this.options = options

    debugLog('WRITER::options:', JSON.stringify(options))

    this.options.availableFormats = ['xlsx', 'csv']
    this.options.defaultEncoding = 'utf8'

    if (options.availableFormats.indexOf(options.exportFormat) < 0)
      throw new Error(`Unsupported file type: ${options.exportFormat}, `
        + `alowed formats are ${options.availableFormats.toString()}`)

    if (this.options.outputFile) {
      debugLog('WRITER::stream file %s', options.outputFile)
      this.outputStream = fs.createWriteStream(options.outputFile)
    } else {
      debugLog('WRITER::stream stdout')
      this.outputStream = process.stdout
    }

    // if we use xlsx export - create workbook first
    if (options.exportFormat === 'xlsx')
      this.options.workbookOpts = {
        stream: this.outputStream,
        useStyles: true,
        useSharedStrings: true,
      }

    this.workbook = new Excel.stream.xlsx.WorkbookWriter(options.workbookOpts)
    this.worksheet = this.workbook.addWorksheet('Worksheet1')
  }

  encode (string) {
    if (this.options.encoding === this.options.defaultEncoding)
      return string

    if (!iconv.encodingExists(this.options.encoding))
      throw new Error(`Encoding does not exist: ${this.options.encoding}`)

    return iconv.encode(string, this.options.encoding)
  }

  // create header
  setHeader (header) {
    debugLog('WRITER::writing header of len %d', header.length)

    if (this.options.exportFormat === 'xlsx')
      return this._writeXlsxHeader(header)
    return this._writeCsvRows([header])
  }

  write (rows) {
    debugLog('WRITER::writing rows len: %d', rows.length)

    if (this.options.exportFormat === 'xlsx')
      return this._writeXlsxRows(rows)
    return this._writeCsvRows(rows)
  }

  _writeXlsxRows (rows) {
    return Promise.map(rows, (row) => {
      // clean row from undefined and empty strings
      const cleanedRow = _.map(row, item => (_.isNil(item) ? null : item))

      this.worksheet.addRow(cleanedRow).commit()
    }, { concurrency: 1 })
  }

  _writeXlsxHeader (header) {
    this.worksheet.columns = header.map(name => ({ header: name }))
    return Promise.resolve()
  }

  _writeCsvRows (data) {
    const opts = {
      delimiter: this.options.csvDelimiter,
    }

    return new Promise((resolve, reject) =>
      stringify(data, opts, (err, string) => {
        if (err)
          return reject(err)

        this.outputStream.write(this.encode(string))
        return resolve()
      })
    )
  }

  flush () {
    debugLog('WRITER::flushing content')
    if (this.options.exportFormat === 'xlsx')
      return this.workbook.commit()
    return Promise.resolve()
  }
}
