const path = require('path')
const url = require('url')
const fs = require('fs')
const https = require('https')
const releaseAssets = require('gh-release-assets')
const { version } = require('../package.json')

const BUILD_DIR = path.resolve(__dirname, '../dist/bundles')
const GITHUB_URL = 'https://api.github.com/repos/elastic/apm-agent-js-base'

function createRelease (token) {
  const releaseUrl = `${GITHUB_URL}/releases`
  const urlObj = url.parse(releaseUrl, false)
  const options = Object.assign({}, urlObj, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'User-Agent': 'APM RUM JS agent' + version
    }
  })
  /**
   * To match the package version with tags
   */
  const tagVersion = 'v' + version
  const changelogUrl = `https://github.com/elastic/apm-agent-js-base/blob/master/CHANGELOG.md`
  const postBody = {
    tag_name: tagVersion,
    name: tagVersion,
    body: `Please check the changelog - ${changelogUrl}`,
    draft: false,
    prerelease: false
  }

  return new Promise((resolve, reject) => {
    const request = https.request(options)
    request.on('response', response => {
      let chunks = ''
      response.on('data', data => (chunks += data))
      response.on('end', () => {
        if (response.statusCode !== 201) {
          reject(chunks)
        }
        resolve(chunks)
      })
    })
    request.on('error', (err) => reject(err))
    request.write(JSON.stringify(postBody))
    request.end()
  })
}

function uploadAssets (uploadUrl, token) {
  /**
   * Exclude the files that are not required for releasing
   *
   * TODO: Remove this filtering logic once we revisit bundling steps
   */
  const assets = fs.readdirSync(BUILD_DIR)
    .filter(file => file.endsWith('.js'))
    .map(file => path.join(BUILD_DIR, file))
  return new Promise((resolve, reject) => {
    releaseAssets({
      url: uploadUrl,
      token,
      assets
    }, (err, assets) => {
      if (err) {
        return reject(err)
      }
      resolve(assets)
    })
  })
}

(async function startRelease () {
  try {
    var token = process.env['GITHUB_TOKEN']
    if (!token) {
      throw new Error('Please provide GITHUB_TOKEN=`token` for creating release')
    }
    console.log('creating release for the tag - ', version)
    const response = await createRelease(token)
    const parsedResponse = JSON.parse(response)
    console.log('release created', parsedResponse.url)
    const uploadUrl = parsedResponse['upload_url']
    await uploadAssets(uploadUrl, token)
    console.log('uploaded all assets to the release')
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
})()
