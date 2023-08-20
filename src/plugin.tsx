import "@logseq/libs"
import { setup, t } from "logseq-l10n"
import { render } from "preact"
import { throttle } from "rambdax"
import FavList from "./comps/FavList"
import { hash, queryForSubItems, setLanguage } from "./libs/utils"
import zhCN from "./translations/zh-CN.json"

let dragHandle: HTMLElement | null = null

async function main() {
  const { preferredLanguage: lang } = await logseq.App.getUserConfigs()
  setLanguage(logseq.settings?.sortingLocale || lang)

  await setup({ builtinTranslations: { "zh-CN": zhCN } })

  provideStyles()

  logseq.useSettingsSchema([
    {
      key: "hierarchyProperty",
      title: "",
      type: "string",
      default: "tags",
      description: t(
        "It controls which property is used to decide a tag's hierarchy.",
      ),
    },
    {
      key: "filterIcon",
      title: "",
      type: "string",
      default: "🔍",
      description: t("Define an icon for quick filters."),
    },
    {
      key: "hoverArrow",
      title: "",
      type: "boolean",
      default: false,
      description: t("Show arrows only when hovered."),
    },
    {
      key: "taggedPageLimit",
      title: "",
      type: "number",
      default: 30,
      description: t(
        "Maximum number of tagged pages to display on each level for favorites.",
      ),
    },
    {
      key: "sortingLocale",
      title: "",
      type: "string",
      default: "",
      description: t(
        "Locale used in sorting hierarchical favorites. E.g, zh-CN. Keep it empty to use Logseq's language setting.",
      ),
    },
  ])

  const favoritesObserver = new MutationObserver(async (mutationList) => {
    const mutation = mutationList[0]
    if (
      (mutation?.target as any).classList?.contains("bd") ||
      (mutation?.target as any).classList?.contains("favorites")
    ) {
      await processFavorites()
    }
  })
  const favoritesEl = parent.document.querySelector("#left-sidebar .favorites")
  if (favoritesEl != null) {
    favoritesObserver.observe(favoritesEl, { childList: true, subtree: true })
  }

  const transactionOff = logseq.DB.onChanged(onTransaction)

  await processFavorites()

  const graph = (await logseq.App.getCurrentGraph())!
  const storedWidth = parent.localStorage.getItem(`kef-ae-lsw-${graph.name}`)
  if (storedWidth) {
    parent.document.documentElement.style.setProperty(
      "--ls-left-sidebar-width",
      `${+storedWidth}px`,
    )
  }

  logseq.provideUI({
    key: "kef-ae-drag-handle",
    path: "#left-sidebar",
    template: `<div class="kef-ae-drag-handle"></div>`,
  })
  setTimeout(() => {
    dragHandle = parent.document.querySelector(
      "#left-sidebar .kef-ae-drag-handle",
    )!
    dragHandle.addEventListener("pointerdown", onPointerDown)
  }, 0)

  logseq.beforeunload(async () => {
    transactionOff()
    favoritesObserver.disconnect()
    dragHandle?.removeEventListener("pointerdown", onPointerDown)
  })

  console.log("#favorite-tree loaded")
}

function provideStyles() {
  logseq.provideStyle({
    key: "kef-ae-fav",
    style: `
      .kef-ae-fav-list {
        padding-left: 24px;
        display: none;
      }
      .kef-ae-fav-expanded {
        display: block;
      }
      .kef-ae-fav-arrow {
        flex: 0 0 auto;
        padding: 4px 20px 4px 10px;
        margin-right: -20px;
        opacity: ${logseq.settings?.hoverArrow ? 0 : 1};
        transition: opacity 0.3s;
      }
      :is(.favorite-item, .recent-item):hover > a > .kef-ae-fav-arrow,
      .kef-ae-fav-item:hover > .kef-ae-fav-arrow {
        opacity: 1;
      }
      .kef-ae-fav-arrow svg {
        transform: rotate(90deg) scale(0.8);
        transition: transform 0.04s linear;
      }
      .kef-ae-fav-arrow-expanded svg {
        transform: rotate(0deg) scale(0.8);
      }
      .kef-ae-fav-item {
        display: flex;
        align-items: center;
        padding: 0 24px;
        line-height: 28px;
        color: var(--ls-header-button-background);
        cursor: pointer;
      }
      .kef-ae-fav-item:hover {
        background-color: var(--ls-quaternary-background-color);
      }
      .kef-ae-fav-item-icon {
        flex: 0 0 auto;
        margin-right: 5px;
        width: 16px;
        text-align: center;
      }
      .kef-ae-fav-item-name {
        flex: 1 1 auto;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .kef-ae-drag-handle {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        right: 0;
        width: 4px;
        z-index: 10;
      }
      .kef-ae-drag-handle:hover,
      .kef-ae-dragging .kef-ae-drag-handle {
        cursor: col-resize;
        background: var(--ls-active-primary-color);
      }
      .kef-ae-dragging {
        cursor: col-resize;
      }
      .kef-ae-dragging :is(#left-sidebar, #main-content-container) {
        pointer-events: none;
      }
    `,
  })
}

async function processFavorites() {
  const favorites = parent.document.querySelectorAll<HTMLElement>(
    `#left-sidebar .favorite-item`,
  )
  for (const fav of favorites) {
    const items = await queryForSubItems(fav.dataset.ref!)
    if (items?.length > 0) {
      injectList(fav, items)
    }
  }
}

async function injectList(el: HTMLElement, items: any[]) {
  const isFav = el.classList.contains("favorite-item")
  const key = `kef-ae-${isFav ? "f" : "r"}-${await hash(el.dataset.ref!)}`

  const arrowContainer = el.querySelector("a")!
  const arrow = arrowContainer.querySelector(".kef-ae-fav-arrow")
  if (arrow != null) {
    arrow.remove()
  }

  if (parent.document.getElementById(key) == null) {
    logseq.provideUI({
      key,
      path: `.${isFav ? "favorite" : "recent"}-item[data-ref="${
        el.dataset.ref
      }"]`,
      template: `<div id="${key}"></div>`,
    })
  }

  setTimeout(() => {
    renderList(key, items, arrowContainer)
  }, 0)
}

function renderList(key: string, items: any[], arrowContainer: HTMLElement) {
  const el = parent.document.getElementById(key)!
  render(<FavList items={items} arrowContainer={arrowContainer} />, el)
}

async function onTransaction({ blocks, txData, txMeta }: any) {
  if (needsProcessing(txData)) {
    await processFavorites()
  }
}

function needsProcessing(txData: any[]) {
  const hierarchyProperty = logseq.settings?.hierarchyProperty ?? "tags"
  let oldProperty, newProperty
  let oldQuickFilters, newQuickFilters
  for (const [_e, attr, val, _tx, added] of txData) {
    if (attr === "originalName") return true
    if (hierarchyProperty === "tags" && attr === "tags") return true
    if (attr === "properties") {
      if (val[hierarchyProperty]) {
        if (added) {
          newProperty = val[hierarchyProperty]
        } else {
          oldProperty = val[hierarchyProperty]
        }
      }
      if (val.quickFilters) {
        if (added) {
          newQuickFilters = val.quickFilters
        } else {
          oldQuickFilters = val.quickFilters
        }
      }
    }
  }
  if (
    (!oldProperty && !newProperty && !oldQuickFilters && !newQuickFilters) ||
    (oldProperty?.toString() === newProperty?.toString() &&
      oldQuickFilters === newQuickFilters)
  )
    return false
  return true
}

function onPointerDown(e: Event) {
  e.preventDefault()
  parent.document.documentElement.classList.add("kef-ae-dragging")
  parent.document.addEventListener("pointermove", onPointerMove)
  parent.document.addEventListener("pointerup", onPointerUp)
  parent.document.addEventListener("pointercancel", onPointerUp)
}

function onPointerUp(e: MouseEvent) {
  e.preventDefault()
  parent.document.removeEventListener("pointermove", onPointerMove)
  parent.document.removeEventListener("pointerup", onPointerUp)
  parent.document.removeEventListener("pointercancel", onPointerUp)
  parent.document.documentElement.classList.remove("kef-ae-dragging")

  const pos = e.clientX
  parent.document.documentElement.style.setProperty(
    "--ls-left-sidebar-width",
    `${pos}px`,
  )
  ;(async () => {
    const graph = (await logseq.App.getCurrentGraph())!
    parent.localStorage.setItem(`kef-ae-lsw-${graph.name}`, `${pos}`)
  })()
}

function onPointerMove(e: MouseEvent) {
  e.preventDefault()
  move(e.clientX)
}

const move = throttle((pos) => {
  parent.document.documentElement.style.setProperty(
    "--ls-left-sidebar-width",
    `${pos}px`,
  )
}, 12)

logseq.ready(main).catch(console.error)