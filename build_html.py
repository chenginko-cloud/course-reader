# -*- coding: utf-8 -*-
"""把 data.json 内联进 template.html，产出可离线打开 / 可直接托管的 index.html。"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "index.html")

data = open(os.path.join(HERE, "data.json"), encoding="utf-8").read()
# 内联进 <script type="application/json">，把 < 转义掉避免提前闭合标签
data = data.replace("<", "\\u003c")
tpl = open(os.path.join(HERE, "template.html"), encoding="utf-8").read()
html = tpl.replace("__DATA__", data)
open(OUT, "w", encoding="utf-8").write(html)

# 兼容旧习惯的两个入口
shim = """<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>课程逐字稿库</title>
<script>location.replace("index.html?mode=%s"+location.hash);</script>
</head><body></body></html>
"""
for name, mode in (("mobile.html", "mobile"), ("desktop.html", "desktop")):
    open(os.path.join(HERE, name), "w", encoding="utf-8").write(shim % mode)

print("index.html  %.1f KB" % (len(html.encode("utf-8")) / 1024))
