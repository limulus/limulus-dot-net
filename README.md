# limulus-dot-net

Source code for [limulus.net], [Eric]’s personal website.

[limulus.net]: https://limulus.net/
[eric]: https://limulus.net/eric/

## Tech

I intend to write more about how I’ve slowly been building out this site, but here’s a quick
overview of the tech stack:

### Site Generation

- [Eleventy]: Static site generator
- [esbuild]: JavaScript bundler
- [sharp]: Image processing
- [AWS CDK]: Infrastructure as code (TypeScript)

[eleventy]: https://www.11ty.dev/
[esbuild]: https://esbuild.github.io/
[sharp]: https://sharp.pixelplumbing.com/
[aws cdk]: https://aws.amazon.com/cdk/

### Hosting

- [S3]: Storage for HTML, CSS and JavaScript
- [CloudFront]: CDN and edge compute
- [bunny.net]: CDN and storage for images and videos (referral link)

[s3]: https://aws.amazon.com/s3/
[cloudfront]: https://aws.amazon.com/cloudfront/
[bunny.net]: https://bunny.net?ref=y8bk49x3t8

## User Guide

This section is largely for my own reference, but it may be useful to you if you’re trying
to understand this codebase.

### Running Locally

```sh
npm install
npm run dev
```

### Development

The `main` branch is automatically deployed to `limulus.net`. Non-content changes that
require testing should be done on a branch. Branches will be deployed to
`${branch}.limulus.net`.

### Infrastructure

The site infrastructure is managed using AWS CDK (TypeScript). The infrastructure code
is located in the `/infra` directory and includes:

- **CloudFront Distribution**: CDN with custom domain, caching policies, and function associations
- **S3 Buckets**: Static site storage and CloudFront access logs
- **CloudFront Functions**: URL rewriting and redirects (TypeScript)
- **Route 53 Records**: DNS configuration for custom domains
- **Origin Access Control**: Secure S3 access via CloudFront
- **SQS Queue**: CloudFront log processing

**Deployment**: Infrastructure is automatically deployed via GitHub Actions when changes are 
pushed to any branch. This is the primary and recommended way to deploy long-lived stacks.

For local development and testing:

```sh
# Synthesize CloudFormation template
npm run cdkc

# View infrastructure diff (requires AWS credentials)
npx cdk diff

# Deploy to test stack (not recommended for production)
npx cdk deploy
```

Note: Local deployments should only be used for development testing. All production 
deployments go through GitHub Actions with proper security controls.

### Writing Content

Most content should be written in a Markdown file under the `www` directory.

#### Frontmatter Properties

- `layout`: Standard Eleventy property to determine the page layout. Can be any of the following:
  - `article`: For text based articles.
  - `video`: For video watch pages.
  - `pages`: Bare-bones layout for things like home pages and indices.
- `tags`: Standard Eleventy property for creating collections. Possible values:
  - `article`: For any article and blog post. Anything that can be syndicated is an article,
    including videos!
  - `development`: For articles about software development
  - `penumbra`: For Penumbra Development Journal entries
  - `video`: For video watch pages.
- `author`: The author identifier, from the [authors database]
- `title`: The title of the article or page
- `subhead`: A subhead or alternate title that appears below the title of an article. It is
  used as the page meta description if present.
- `date`: The date and time of first publication, in ISO 8601 format
- `history`: A list of significant edits to the page. The most recent edit must be listed
  first. Each entry in this list should contain:
  - `date`: The date and time of the edit, in ISO 8601 format
  - `change`: ⚠️ Not yet implemented but the idea would be to be an annotation that could be
    included on the page and RSS feed. This would remain optional for edits that are just
    fixes for typos or to fix search engine indexing.
- `image`: Photo identifier used only for the preview images on article cards and Open Graph
  tags
- `teaser`: A short description of the article or page used in previews and page metadata.
  Note that if `subhead` is present this will be used for the page meta description instead.
- `hero`: The identifier of the photo in the [photos database] to use as the hero image
- `vod`: Data for a video:
  - `id`: The identifier of the video on `vod.limulus.net`
  - `alt`: Alternate text for the poster image
  - `duration`: The duration in seconds of the video

[authors database]: www/_data/authors.json

### Media Management

#### Photos

Photos are hosted on `pho.limulus.net`. They are not stored in this repository. Before
publishing an article with a photo, prepare the photo by following these steps:

1. Ensure the photo is in your Apple Photos library. Give the photo a title and caption. The
   caption will be used as the alt text for the photo. Also set the following tags:

   - `limulus.net`: Tracks if the photo is used on limulus.net.
   - `limulus.net/photos`: Indicates photo should have a photo page.
   - `license:cc-by`: CC-BY license.

2. Export the photo from Apple Photos. Use the following settings:

   - File format: PNG
   - Color Profile: Display P3
   - Size: Full Size
   - Include Title, Keywords, and Caption
   - Include Location Information (optional)

3. Run this repo in a Codespace, and upload the photo to the `photos` directory.

4. Run the photo processing script: `npm run photos`. This script will:

   - Read the photos from the `photos` directory.
   - Generate hashes to use as an identifier for each photo.
   - Extract metadata using `sharp`.
   - Generate multiple renditions of each photo using `sharp`.
   - Upload the photos to `pho.limulus.net`.
   - Create a JSON file with the metadata for each photo and uploads it as `index.json`.
   - Update the repository’s [photos database] with the new entries.

5. Retrieve the ids for the photos from the photos database file.

[photos database]: www/_data/photos.json

It is up to you to commit the changes to the photos database. If you don’t, the uploaded
photos will effectively be orphaned.

#### Videos

Videos are hosted on `vod.limulus.net`. Use the `hls-prep.js` script from [media-tools] to
prepare a video for upload.

[media-tools]: https://github.com/limulus/media-tools/

#### Scripts

Any `index.js` or `worker.js` file will be turned into ES module bundle by `esbuild`. The
file names will contain a hash in the form of `index.<hash>.js` and `worker.<hash>.js`.

To import these files, either from another script or via a `<script>` tag, reference the
file with 8 `X`s in place of the hash. For example: `index.XXXXXXXX.js`.

To ease script inclusion in articles, use the `scripts` frontmatter property. It can be
either a single string or an array of strings. Note that it is not necessary to put hash
placeholders in these paths — they will be added automatically.
