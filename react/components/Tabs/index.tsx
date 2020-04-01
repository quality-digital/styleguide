import React, {
  cloneElement,
  FC,
  useState,
  useRef,
  useCallback,
  useLayoutEffect,
  Children,
  useEffect,
} from 'react'
import PropTypes, { InferProps } from 'prop-types'
import debounce from 'lodash/debounce'

import Tab from './Tab'
import Menu from '../Menu'
import OptionsDots from '../icon/OptionsDots'
import withDevice from '../utils/withDeviceHoc'

const RESIZE_DELAY_TIME = 125
const DEFAULT_TAB_WIDTH = 128

interface HandleHideTabsInput {
  tabs: HTMLCollection
  tabsContainerWidth: number
  tabsContainerFullWidth?: number
  selectedTabIndex: number
  tabsOrderList: number[]
  fullWidth?: boolean
  isMobile?: boolean
}

interface HandleHideTabsOutput {
  hideTabs: boolean
  tabIndex: number
}

interface HandleShowSelectedHiddenTabInput extends HandleHideTabsOutput {
  tabsOrderList: number[]
  selectedTabIndex: number
  setTabsOrderList: (input: number[]) => void
}

const mapArrayToIndex: <T>(array: T[]) => number[] = array =>
  array.map((_, index) => index)

const handleHideTabs = ({
  tabsContainerWidth,
  tabsContainerFullWidth = 0,
  tabs, // list with rendered tabs
  selectedTabIndex,
  tabsOrderList,
  fullWidth,
  isMobile,
}: HandleHideTabsInput): HandleHideTabsOutput => {
  let hideTabs = false
  let tabIndex = 0
  if (isMobile || fullWidth) {
    // handle fullwidth
    const numberOfTabs = tabsContainerFullWidth / DEFAULT_TAB_WIDTH
    tabIndex = numberOfTabs - (numberOfTabs % 1)
    hideTabs = tabIndex < tabsOrderList.length
  } else {
    const normalizedIndex = tabsOrderList.indexOf(selectedTabIndex)
    let sumTabsWidth = tabs[normalizedIndex].clientWidth

    // verify if is necessary hide tabs
    for (; tabIndex < tabs.length; tabIndex++) {
      const { clientWidth: childWidth } = tabs[tabIndex]
      if (tabIndex !== normalizedIndex) {
        sumTabsWidth += childWidth || DEFAULT_TAB_WIDTH
      }

      if (sumTabsWidth > tabsContainerWidth) {
        hideTabs = true
        if (tabIndex <= normalizedIndex) {
          tabIndex++
        }
        break
      }
    }

    // verify if the last tab can fit without more tabs button
    if (
      hideTabs &&
      tabIndex + 1 === tabs.length &&
      sumTabsWidth <= tabsContainerFullWidth
    ) {
      hideTabs = false
      tabIndex = tabs.length
    }
  }

  return { hideTabs, tabIndex }
}

const handleShowSelectedHiddenTab = ({
  tabsOrderList,
  hideTabs,
  selectedTabIndex,
  tabIndex,
  setTabsOrderList,
}: HandleShowSelectedHiddenTabInput): void => {
  if (hideTabs && selectedTabIndex >= tabIndex) {
    const leftList = tabsOrderList.slice(0, tabIndex - 1)
    const rightList = tabsOrderList
      .slice(tabIndex - 1)
      .filter(i => i !== selectedTabIndex)
    setTabsOrderList(leftList.concat([selectedTabIndex]).concat(rightList))
  } else {
    setTabsOrderList(tabsOrderList)
  }
}

const propTypes = {
  children: PropTypes.node,
  fullWidth: PropTypes.bool,
  isMobile: PropTypes.bool,
  sticky: PropTypes.bool,
}

const Tabs: FC<InferProps<typeof propTypes>> = ({
  children,
  fullWidth,
  isMobile,
  sticky,
}) => {
  const childrenArray: Tab[] = Children.toArray(children)

  // enable or desable menu with tabs that's hidden
  const [showMoreTabsButton, setShowMoreTabsButton] = useState(false)
  const [tabsMenuOpen, setTabsMenuOpen] = useState(false)
  const [lastShownTab, setLastShowTab] = useState(childrenArray.length)
  const [tabsOrderList, setTabsOrderList] = useState(
    mapArrayToIndex(childrenArray)
  )

  // Handle tabs width to calculate if should hide them
  const tabsContainerRef = useRef<HTMLDivElement>(null)
  const tabsFullContainerRef = useRef<HTMLDivElement>(null)
  // Handle tabs menu actions
  const moreTabsButtonRef = useRef<HTMLButtonElement>(null)
  const tabsMenuRef = useRef<Menu>(null)

  const selectedTabIndex: number = childrenArray.reduce(
    (resultTabIndex: number, tab: Tab, index: number) =>
      tab.props.active ? index : resultTabIndex,
    0
  )
  const selectedTab: Tab = childrenArray[selectedTabIndex]
  const content = selectedTab && selectedTab.props.children

  const handleOpenTabMenu = () => {
    !tabsMenuOpen && setTabsMenuOpen(true)
  }

  const calculateTabsVisibility = (): void => {
    const { clientWidth: tabsContainerWidth } = tabsContainerRef.current
    const tabs = tabsContainerRef.current.children

    // verify if is necessary hide tabs
    const { hideTabs, tabIndex } = handleHideTabs({
      tabsContainerWidth,
      tabsContainerFullWidth: tabsFullContainerRef.current?.clientWidth,
      tabs,
      selectedTabIndex,
      tabsOrderList,
      fullWidth,
      isMobile,
    })

    // change display tabs order - every hidden selected tab should be displayed
    const newTabsOrderList = mapArrayToIndex(childrenArray)
    handleShowSelectedHiddenTab({
      tabsOrderList: newTabsOrderList,
      hideTabs,
      tabIndex,
      selectedTabIndex,
      setTabsOrderList,
    })

    setShowMoreTabsButton(hideTabs)
    setLastShowTab(tabIndex)
  }

  const handleResizeWindow = useCallback(
    debounce(
      () => {
        if (tabsContainerRef.current) {
          calculateTabsVisibility()

          setTabsMenuOpen(false) // close every resize
        }
      },
      RESIZE_DELAY_TIME,
      { trailing: true }
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tabsContainerRef, tabsFullContainerRef, selectedTabIndex]
  )

  useLayoutEffect(() => {
    const handleChangeSelectedTab = () => {
      if (tabsContainerRef.current) {
        calculateTabsVisibility()
      }
    }

    handleChangeSelectedTab()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTabIndex])

  useLayoutEffect(() => {
    const hasWindow = !(
      typeof window === 'undefined' || typeof window.Element === 'undefined'
    )
    if (hasWindow) {
      window.addEventListener('resize', handleResizeWindow)
    }

    return () => {
      hasWindow && window.removeEventListener('resize', handleResizeWindow)
    }
  }, [handleResizeWindow])

  useEffect(() => {
    const handleClickOutsideMenu = event => {
      if (
        moreTabsButtonRef.current?.contains(event.target) ||
        tabsMenuRef.current?.contains(event.target)
      ) {
        return
      }
      setTabsMenuOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutsideMenu, false)

    return () => {
      document.removeEventListener('mousedown', handleClickOutsideMenu, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getHiddenTabProps = (tabIndex: number) => {
    const { label, onClick } = childrenArray[tabIndex].props
    return { label, onClick }
  }

  const getAllHiddenTabs = () =>
    tabsOrderList.slice(lastShownTab).map(getHiddenTabProps)

  const renderTabs = tabsOrderList.map((tabIndex, index) => {
    const child: Tab = childrenArray[tabIndex]
    const hidden = index >= lastShownTab

    return (
      !(hidden && (fullWidth || isMobile)) &&
      cloneElement(child, {
        fullWidth,
        key: child.props.key ?? index,
        hidden,
      })
    )
  })

  return (
    <div
      data-testid={testId}
      className={`vtex-tabs w-100 h-100 flex flex-column ${
        sticky ? 'overflow-y-hidden' : ''
      }`}>
      <div className="flex">
        <div
          className="vtex-tabs__nav inline-flex flex-row bb b--muted-4 w-100 overflow-hidden"
          ref={tabsContainerRef}>
          {renderTabs}
        </div>
        {showMoreTabsButton && (
          <Menu
            ref={tabsMenuRef}
            options={getAllHiddenTabs()}
            open={tabsMenuOpen}
            onClose={() => {
              setTabsMenuOpen(false)
            }}>
            <button
              ref={moreTabsButtonRef}
              onClick={handleOpenTabMenu}
              className={`
                vtex-tab__button
                vtex-tab__button--inactive
                over-c-action-primary
                hover-c-action-primary
                c-muted-1
                b--transparent
                bt-0 bl-0 br-0 bb-0
                v-mid
                pointer
                relative
                h-regular
                t-body
                bg-transparent
                outline-0
              `}>
              <OptionsDots color="currentColor" />
            </button>
          </Menu>
        )}
      </div>
      <div ref={tabsFullContainerRef} className="w-100"></div>
      <div
        className={`vtex-tabs__content w-100 ${
          sticky ? 'overflow-y-auto' : ''
        }`}
      >
        {content}
      </div>
    </div>
  )
}

Tabs.defaultProps = {
  fullWidth: false,
  sticky: false,
}

Tabs.propTypes = propTypes

export default withDevice(Tabs)