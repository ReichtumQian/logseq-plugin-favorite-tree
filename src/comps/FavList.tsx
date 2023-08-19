import { produce } from "immer"
import { createPortal } from "preact/compat"
import { useEffect, useState } from "preact/hooks"
import { cls } from "reactutils"
import { queryForSubItems } from "../libs/utils"
import FavArrow from "./FavArrow"

export default function FavList({
  items,
  arrowContainer,
}: {
  items: any[]
  arrowContainer: HTMLElement
}) {
  const [expanded, setExpanded] = useState(false)

  function toggleList(e: Event) {
    e.preventDefault()
    e.stopPropagation()
    setExpanded((v) => !v)
  }

  return (
    <>
      {createPortal(
        <FavArrow expanded={expanded} onToggle={toggleList} />,
        arrowContainer,
      )}
      <SubList items={items} shown={expanded} />
    </>
  )
}

function SubList({ items, shown }: { items: any[]; shown: boolean }) {
  const [childrenData, setChildrenData] = useState<any>(null)

  useEffect(() => {
    setChildrenData(null)
  }, [items])

  useEffect(() => {
    if (shown && childrenData == null) {
      ;(async () => {
        const data: any = {}
        for (const item of items) {
          if (item.filters) {
            if (item.subitems) {
              data[item.displayName] = {
                expanded: false,
                items: Object.values(item.subitems),
              }
            }
          } else {
            const subitems = await queryForSubItems(item["original-name"])
            if (subitems?.length > 0) {
              data[item.name] = { expanded: false, items: subitems }
            }
          }
        }
        setChildrenData(data)
      })()
    }
  }, [shown, childrenData, items])

  async function openPage(e: MouseEvent, item: any) {
    e.preventDefault()
    e.stopPropagation()

    if (item.filters) {
      let content = (await logseq.Editor.getBlock(
        item.blockUUID,
      ))!.content.replace(/\n*^filters:: .*\n*/m, "")
      content += `\nfilters:: ${`{${item.filters
        .map((filter: string) => `"${filter.toLowerCase()}" true`)
        .join(", ")}}`}`
      await logseq.Editor.updateBlock(item.blockUUID, content)
    }

    const url = new URL(`http://localhost${parent.location.hash.substring(6)}`)
    const isAlreadyOnPage =
      decodeURIComponent(url.pathname.substring(1)) === item.name
    if (!isAlreadyOnPage) {
      if (e.shiftKey) {
        logseq.Editor.openInRightSidebar(item.uuid ?? item.pageUUID)
      } else {
        ;(logseq.Editor.scrollToBlockInPage as any)(item.name)
      }
    } else if (item.filters) {
      if (e.shiftKey) {
        // NOTE: right sidebar refreshing is not possible yet.
        logseq.Editor.openInRightSidebar(item.uuid ?? item.pageUUID)
      } else {
        // HACK: remove this hack later when Logseq's responsive refresh is fixed.
        ;(logseq.Editor.scrollToBlockInPage as any)(item.blockUUID)
        setTimeout(() => {
          ;(logseq.Editor.scrollToBlockInPage as any)(item.name)
        }, 50)
      }
    }
  }

  function toggleChild(e: Event, itemName: string) {
    e.preventDefault()
    e.stopPropagation()
    const newChildrenData = produce(childrenData, (draft: any) => {
      draft[itemName].expanded = !draft[itemName].expanded
    })
    setChildrenData(newChildrenData)
  }

  function preventSideEffect(e: Event) {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div
      class={cls("kef-ae-fav-list", shown && "kef-ae-fav-expanded")}
      onMouseDown={preventSideEffect}
    >
      {items.map((item) => {
        const displayName = item.displayName ?? item["original-name"]
        const data = item.filters
          ? childrenData?.[item.displayName]
          : childrenData?.[item.name]

        return (
          <div key={item.name}>
            <div class="kef-ae-fav-item" onClick={(e) => openPage(e, item)}>
              {item.filters ? (
                <div class="kef-ae-fav-item-icon">
                  {logseq.settings?.filterIcon ?? "🔎"}
                </div>
              ) : item.properties?.icon ? (
                <div class="kef-ae-fav-item-icon">{item.properties?.icon}</div>
              ) : (
                <span class="ui__icon tie tie-page kef-ae-fav-item-icon"></span>
              )}
              <div class="kef-ae-fav-item-name" title={displayName}>
                {item.filters &&
                displayName.toLowerCase().startsWith(`${item.name}/`)
                  ? displayName.substring(item.name.length + 1)
                  : displayName}
              </div>
              {data && (
                <FavArrow
                  expanded={data.expanded}
                  onToggle={(e: Event) =>
                    item.filters
                      ? toggleChild(e, item.displayName)
                      : toggleChild(e, item.name)
                  }
                />
              )}
            </div>
            {data?.items?.length > 0 && (
              <SubList items={data.items} shown={data.expanded} />
            )}
          </div>
        )
      })}
    </div>
  )
}
