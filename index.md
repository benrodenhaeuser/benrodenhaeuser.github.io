---
layout: default
---

{% assign post = site.posts.first %}
<small>{{ post.date | date_to_long_string }}</small>
{{ post.content }}
