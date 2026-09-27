# -*- coding: utf-8 -*-
"""
抽取「案例课程」目录下的两门课，生成 course-reader 用的结构化 JSON。

课程一：《如何唤醒孩子的自驱力》  来源：家卫老师-如何唤醒孩子的自驱力.docx
        目录结构 = Heading1(章) / Heading2(课)

课程二：《自学方法》              来源：01_*.txt ~ 23_*.txt（ASR 逐字转写，无标点）
        需要做断句：按空格切分语段 -> 依据语气词/连接词/长度合成句子与段落
"""
import glob
import html
import json
import os
import re
import zipfile

SRC_DIR = "/Users/Zhuanz/Downloads/案例课程"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.json")

# --------------------------------------------------------------------------
# 一、docx 解析
# --------------------------------------------------------------------------
NS_P = re.compile(r"<w:p[ >].*?</w:p>|<w:p/>", re.S)


def docx_paragraphs(path):
    """返回 [(style, text), ...]，保持文档顺序。"""
    z = zipfile.ZipFile(path)
    xml = z.read("word/document.xml").decode("utf-8")
    out = []
    for p in NS_P.findall(xml):
        m = re.search(r'w:pStyle w:val="([^"]+)"', p)
        style = m.group(1) if m else ""
        txt = html.unescape(re.sub(r"<[^>]+>", "", p))
        txt = txt.replace("\u00a0", " ").strip()
        out.append((style, txt))
    return out


def clean_chapter(t):
    """第一章：压力系统 -> 压力系统"""
    t = re.sub(r"^第[一二三四五六七八九十]+章[：:]\s*", "", t)
    return t.strip()


def clean_lesson(t):
    """01．压力系统概述 -> 01 压力系统概述"""
    t = re.sub(r"^(\d{1,2})\s*[．.、]\s*", r"\1 ", t)
    return t.strip()


def build_course1():
    path = os.path.join(SRC_DIR, "家卫老师-如何唤醒孩子的自驱力.docx")
    paras = docx_paragraphs(path)
    lessons = []
    chapter = ""
    cur = None
    started = False

    for style, txt in paras:
        if not txt:
            continue
        # 跳过目录域（含 HYPERLINK / PAGEREF / TOC）
        if "HYPERLINK" in txt or "PAGEREF" in txt or txt.startswith("TOC "):
            continue
        if style in ("5", "7"):          # 目录里的 TOC 级别样式
            continue
        if style == "8":                 # Heading 1
            started = True
            if txt.startswith("前言"):
                chapter = "前言"
                cur = {"chapter": "前言", "title": "前言", "paras": []}
                lessons.append(cur)
                continue
            if txt.startswith("总结"):
                chapter = "总结"
                cur = {"chapter": "总结", "title": "总结（重要）", "paras": []}
                lessons.append(cur)
                continue
            chapter = clean_chapter(txt)
            cur = None
            continue
        if style == "6":                 # Heading 2 = 一节课
            if not started:
                continue
            cur = {"chapter": chapter, "title": clean_lesson(txt), "paras": []}
            lessons.append(cur)
            continue
        if not started:
            continue                     # 封面标题等
        if cur is None:
            continue
        cur["paras"].append(txt)

    for l in lessons:
        l["paras"] = [p for p in l["paras"] if p]
    return {
        "id": "c1",
        "name": "如何唤醒孩子的自驱力",
        "author": "家卫老师",
        "desc": "压力系统 · 动力系统 · 惯性系统 · 唤醒系统",
        "source": "docx 讲稿",
        "lessons": lessons,
    }


# --------------------------------------------------------------------------
# 二、ASR 逐字稿断句
# --------------------------------------------------------------------------
# 出现在语段开头时，说明上一句已经说完了（句末用句号）
STRONG_START = (
    "那么", "所以", "但是", "可是", "然后", "其实", "比如说", "比如",
    "第一个", "第二个", "第三个", "第四个", "第五个", "第六个",
    "首先", "其次", "最后", "总之", "总结一下", "好吧", "记住",
    "注意", "接下来", "再来", "这里", "为什么", "怎么办", "什么叫做",
    "各位", "大家", "我们来看", "我再", "我举", "你看", "你记住",
    "举个例子", "换句话说", "另外", "还有", "而且", "因为",
)
# 出现在语段开头时，仍然属于上一句（句中标点用逗号）
WEAK_START = (
    "就是", "这种", "这个", "那个", "这样", "那样", "的话", "的时候",
    "反而", "并且", "而且", "也", "就", "又", "却", "才", "只是", "甚至",
    "更", "还", "以及", "而", "同时", "于是", "因此", "一旦", "否则",
    "随之", "进而", "从而", "与其", "不如", "对", "跟", "和", "或",
)
SENT_MIN = 34          # 单句最短长度，达到即可收句
PARA_TARGET = 190      # 段落目标长度


def _norm_punct(s):
    """半角 -> 全角，合并重复标点，去掉句末多余逗号。"""
    s = (s.replace(",", "，").replace(";", "；").replace(":", "：")
           .replace("?", "？").replace("!", "！"))
    s = re.sub(r"\.(?=\s|$|[^0-9])", "。", s)      # 保留小数/序号里的点
    s = re.sub(r"[，、；：]{2,}", "，", s)
    s = re.sub(r"[，、；：]+(?=[。？！])", "", s)
    s = re.sub(r"[。？！]{2,}", "。", s)
    s = re.sub(r"^[，、；：。？！]+", "", s)
    return s.strip()


def _end_punct(last_seg):
    tail = last_seg[-1:] if last_seg else ""
    if tail in "。？！":
        return ""
    if tail == "吗":
        return "？"
    if tail in "呢吧" and len(last_seg) > 6:
        return "？"
    return "。"


def punctuate(raw):
    """把无标点 ASR 文本切成带标点、分段落的字符串列表。"""
    text = re.sub(r"\s+", " ", raw.replace("\r", " ").replace("\n", " ")).strip()
    text = _norm_punct(text)
    segs = [s for s in re.split(r"\s+", text) if s]
    if not segs:
        return []
    # 原始文本自带的句末标点，也视为一个断句信号
    for i in range(len(segs) - 1):
        if segs[i].endswith(("。", "？", "！")):
            segs[i] += "\x00"
    segs = [s.replace("\x00", "") or s for s in segs]
    hard_end = [s.endswith(("。", "？", "！")) for s in segs]

    sentences = []
    buf = []                       # 当前句内的语段
    buflen = 0
    for i, seg in enumerate(segs):
        start_new = False
        if buf:
            if hard_end[i - 1]:
                start_new = True
            elif any(seg.startswith(k) for k in STRONG_START[:22]):
                start_new = True
            elif buflen >= SENT_MIN and not any(seg.startswith(k) for k in WEAK_START):
                start_new = True
        if start_new:
            sentences.append(buf)
            buf, buflen = [], 0
        buf.append(seg)
        buflen += len(seg)
    if buf:
        sentences.append(buf)

    # 组装成带标点的句子
    texts = []
    for parts in sentences:
        s = parts[0] + ("，" + "，".join(parts[1:]) if len(parts) > 1 else "")
        s = _norm_punct(s)
        if s:
            texts.append(s)

    # 组装段落
    paras, cur = [], []
    for i, s in enumerate(texts):
        is_last = i == len(texts) - 1
        close = _end_punct(s)
        nxt = texts[i + 1] if not is_last else ""
        cur.append(s + close)
        length = sum(len(x) for x in cur)
        next_strong = any(nxt.startswith(k) for k in STRONG_START[:22])
        if is_last or length >= PARA_TARGET or (length >= 110 and next_strong):
            paras.append("".join(cur))
            cur = []
    if cur:
        paras.append("".join(cur))
    return [_norm_punct(p) for p in paras if p]


def lesson_title_from_file(name):
    base = re.sub(r"\s*\(transcribed.*\)", "", name)
    base = re.sub(r"\.txt$", "", base)
    m = re.match(r"^(\d{1,2})[_\-\s]*(.+)$", base)
    if m:
        return "%s %s" % (m.group(1).zfill(2), m.group(2).strip())
    return base.strip()


def build_course2():
    files = sorted(glob.glob(os.path.join(SRC_DIR, "*.txt")))
    lessons = []
    for f in files:
        name = os.path.basename(f)
        title = lesson_title_from_file(name)
        raw = open(f, encoding="utf-8").read()
        paras = punctuate(raw)
        lessons.append({"chapter": "自学方法", "title": title, "paras": paras})
    return {
        "id": "c2",
        "name": "自学方法",
        "author": "星星学长",
        "desc": "23 节 · 学科方法 · 学习动力 · 考试心态",
        "source": "语音转写逐字稿",
        "lessons": lessons,
    }


# --------------------------------------------------------------------------
def main():
    courses = [build_course1(), build_course2()]
    for ci, c in enumerate(courses):
        for li, l in enumerate(c["lessons"]):
            l["id"] = "%s-%d" % (c["id"], li + 1)
            l["course"] = c["name"]
            l["n"] = li + 1
            l["chars"] = sum(len(p) for p in l["paras"])
    data = {"courses": courses}
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))

    for c in courses:
        print("== %s (%s) 课时 %d" % (c["name"], c["author"], len(c["lessons"])))
        for l in c["lessons"]:
            print("   - %-28s %5d 字  %2d 段" % (l["title"], l["chars"], len(l["paras"])))
    print("\n总字数:", sum(l["chars"] for c in courses for l in c["lessons"]))


if __name__ == "__main__":
    main()
