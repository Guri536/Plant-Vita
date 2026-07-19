---
layout: default
title: Plant-Vita
---
{% include nav.html %}
{% capture readme %}
{% include_relative README.md %}
{% endcapture %}

{{ readme | markdownify }}