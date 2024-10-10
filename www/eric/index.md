---
layout: page
title: About Eric McCarthy
teaser: >-
  Eric McCarthy is a web-centric software engineer living in Tucson, Arizona.
---

# {{title}}

I’m a web-centric software engineer living in Tucson, Arizona. This site, [limulus.net], is
my personal website.

In March 2018, [I got married]!

[limulus.net]: https://limulus.net/
[i got married]: https://reyes-mccarthy.wedding/

<!-- add more of a bio, link to wedding website -->

## Contact

The best way to contact me is by email, at [eric@limulus.net].

[eric@limulus.net]: mailto:eric@limulus.net

## Eric Elsewhere on the Web

My handle on the [fediverse] is [eric@limulus.net][fedi link]{rel="me"} ([acct
link]{rel="me"}).

[fediverse]: https://en.wikipedia.org/wiki/Fediverse
[acct link]: acct:eric@limulus.net
[fedi link]: https://limulus.net/@eric

### Tenancy on Private Platforms

I am most active on fedi, but I also maintain accounts on other private platforms:

- [LinkedIn]{rel="me"}
- [GitHub]{rel="me"}
- [npm]{rel="me"}

I also have inactive accounts here:

- [Facebook]{rel="me"}
- [Twitter]{rel="me"}
- [Flickr]{rel="me"}

[linkedin]: https://www.linkedin.com/in/limulus/
[github]: https://github.com/limulus/
[npm]: https://www.npmjs.org/~limulus/
[facebook]: https://www.facebook.com/theLimulus
[twitter]: https://twitter.com/limulus
[flickr]: https://www.flickr.com/photos/limulus/

## Recent Posts

{% renderTemplate 'webc' %}
<article-list :@articles="collections.all" author="eric" limit="4"></article-list>
{% endrenderTemplate %}
