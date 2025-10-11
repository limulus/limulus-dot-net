---
pagination:
  data: collections.tilTopics
  size: 1
  alias: topic
layout: page
eleventyComputed:
  permalink: "/tils/{{ topic }}/"
  title: "TILs: {{ topic }}"
  teaser: "Things I've learned about {{ topic }}."
---

# {{ title }}

{{ teaser }}

{% for til in collections.til %}
{% if til.data.tilTopic == topic %}
- [{{ til.data.title }}]({{ til.url }})
{% endif %}
{% endfor %}
