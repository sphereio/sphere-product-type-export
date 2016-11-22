import _ from 'lodash'
import stringify from 'csv-stringify'
import Promise from 'bluebird'
import iconv from 'iconv-lite'
import Excel from 'exceljs'

const fs = Promise.promisifyAll(require('fs'))

export default class Writer {
  constructor (options) {
    this.options = options

    this.options.supportedFormats = ['xlsx', 'csv']
    this.options.defaultEncoding = 'utf8'
    this.options.encoding = options.encoding || this.options.defaultEncoding

    if (!options.outputFile)
      throw new Error('OutputFile was not specified')

    if (options.supportedFormats.indexOf(options.exportFormat) < 0)
      throw new Error(`Unsupported file type: ${options.exportFormat}, `
        + `supported formats are ${options.supportedFormats.toString()}`)

    if (options.encoding && !iconv.encodingExists(options.encoding))
      throw new Error(`Encoding does not exist: ${options.encoding}`)

    this.outputStream = fs.createWriteStream(options.outputFile)

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
    if (!this.options.encoding
      || this.options.encoding === this.options.defaultEncoding)
      return string

    return iconv.encode(string, this.options.encoding)
  }

  // create header
  setHeader (header) {
    if (this.options.exportFormat === 'xlsx')
      return this._writeXlsxHeader(header)
    return this._writeCsvRows([header])
  }

  write (rows) {
    if (this.options.exportFormat === 'xlsx')
      return this._writeXlsxRows(rows)
    return this._writeCsvRows(rows)
  }

  _writeXlsxRows (rows) {
    return Promise.map(rows, (row) => {
      // clean row from undefined and empty strings
      const cleanedRow = _.map(row, (item) => {
        if (_.isNil(item))
          return ''
        else if (_.isBoolean(item))
          return item ? 1 : ''
        return item
      })

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

    return new Promise(resolve =>
      stringify(data, opts, (err, string) => {
        this.outputStream.write(this.encode(string))
        return resolve()
      })
    )
  }

  flush () {
    if (this.options.exportFormat === 'xlsx')
      return this.workbook.commit()
    return Promise.resolve()
  }
}
