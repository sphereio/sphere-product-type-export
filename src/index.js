import 'babel-polyfill'
import ProductTypeExport from './product-type-export'
// import { getSphereClientCredentials } from './utils'

// const PROJECT_KEY = 'toom-pre-staging-38'
// const logger = {
//   trace: console.log,
//   debug: console.log,
//   info: console.log,
//   error: console.error,
// }
//
// getSphereClientCredentials(PROJECT_KEY)
// .then(sphereCredentials => {
//   const options = {
//     config: sphereCredentials,
//   }
//
//   const productTypeExport = new ProductTypeExport(
//     logger,
//     { sphereClientConfig: options }
//   )
//   productTypeExport.run().then(() => console.log('done done'))
// })

export default ProductTypeExport
