import Promise from 'bluebird'
import { randomBytes } from 'crypto'
import { SphereClient } from 'sphere-node-sdk'

import getSphereClientCredentials from '../src/sphere-client-credentials'

export const PROJECT_KEY = process.env.CI === 'true'
  ? process.env.SPHERE_PROJECT_KEY
  : process.env.npm_config_projectkey

export function getClientConfig (projectKey = PROJECT_KEY) {
  return getSphereClientCredentials(projectKey)
}

export function getClient (projectKey = PROJECT_KEY) {
  return getClientConfig(projectKey)
    .then(config => new SphereClient({ config }))
}

export function deleteAll (service, client) {
  return client[service].process(({ body: { results } }) =>
    Promise.all(results.map(productType =>
      client[service]
        .byId(productType.id)
        .delete(productType.version)
    ))
  )
}

export function random () {
  return !!Math.round(Math.random())
}

export function createProductType () {
  return {
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
          }, {
            key: 'panda',
            label: 'Panda',
          }, {
            key: 'black',
            label: 'Black',
          }, {
            key: 'sloth',
            label: 'Sloth',
          }, {
            key: 'spectacled',
            label: 'Spectacled',
          }, {
            key: 'asian',
            label: 'Asian',
          }, {
            key: 'ursinae',
            label: 'ursinae',
          }, {
            key: 'short-faced',
            label: 'Short-faced',
          }, {
            key: 'kodiak',
            label: 'Kodiak',
          }, {
            key: 'syrian',
            label: 'Syrian',
          }, {
            key: 'himalayan',
            label: 'Himalayan',
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
  }
}

export function generateTestProductTypes (len) {
  const productTypes = Array.from(new Array(len), () => createProductType())
  return productTypes.map(type => ({
    ...type, attributes: type.attributes.filter(a => !!a),
  }))
}

export function getMockAttributes (productTypes) {
  return productTypes.reduce((attributes, type) =>
    [
      ...type.attributes.filter(attr =>
        // filter out already collected attributes
        !attributes.some(existingAttr => existingAttr.name === attr.name)
      ),
      ...attributes,
    ]
    , [])
}
