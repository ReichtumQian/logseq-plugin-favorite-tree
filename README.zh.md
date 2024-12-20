[English](README.md) | 中文

此版本是 sethyuan 大神不再维护的版本，个人用于 LogSeq 0.10.9 版本。从 Action 中下载 zip 包，然后可能要在 `custom.css` 中输入以下内容才能正常工作（个人完全不懂前端）：

```css
.kef-ft-fav-arrow {
  position: relative;
  right: 0px;  /* 向左移动 */
}

[id^="radix-"] {
  display: none;
}
```

zip 包也可以在这里下载：[蓝奏云](https://wwek.lanzoue.com/ixqz82ikvuli)

# logseq-plugin-favorite-tree

一个在左侧边栏的树形结构的收藏。

## 功能

- 基于 namespace 或者页面属性实现树形“收藏”。可通过`fixed`页面属性来调整展示顺序，例如 `fixed:: 100`，数值越小位置越靠前。
- 可在页面上通过属性设置组合过滤器，会在树形收藏上展示。可参见下方演示视频。
- 通过拖拽来调整左侧边栏宽度。

## 使用展示

https://github.com/sethyuan/logseq-plugin-another-embed/assets/3410293/32b2a19e-19b3-4113-8fee-f2a445d151cc

https://github.com/sethyuan/logseq-plugin-another-embed/assets/3410293/d586158a-6781-44fd-931b-1eca8c4df780
