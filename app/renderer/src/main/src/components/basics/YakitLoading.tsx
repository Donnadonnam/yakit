import React, {useEffect, useMemo, useRef, useState} from "react"
import {YakitLoadingSvgIcon, YakitThemeLoadingSvgIcon} from "./icon"
import {Checkbox, Progress} from "antd"
import {DownloadingState, YakitStatusType, YakitSystem, YaklangEngineMode} from "@/yakitGVDefine"
import {outputToWelcomeConsole} from "@/components/layout/WelcomeConsoleUtil"
import {YakitMenu} from "../yakitUI/YakitMenu/YakitMenu"
import {useGetState, useMemoizedFn} from "ahooks"
import {
    ArrowRightSvgIcon,
    ChevronDownSvgIcon,
    HelpSvgIcon,
    MacUIOpCloseSvgIcon,
    WinUIOpCloseSvgIcon,
    YakitCopySvgIcon,
    YaklangInstallHintSvgIcon
} from "../layout/icons"
import {YakitButton} from "../yakitUI/YakitButton/YakitButton"
import Draggable from "react-draggable"
import type {DraggableEvent, DraggableData} from "react-draggable"
import {failed, success} from "@/utils/notification"
import {YakitModal} from "../yakitUI/YakitModal/YakitModal"
import {RemoveIcon} from "@/assets/newIcon"

import classnames from "classnames"
import styles from "./yakitLoading.module.scss"
import remoteImg from "../../assets/engineMode/remote.png"
import localImg from "../../assets/engineMode/local.png"
import adminImg from "../../assets/engineMode/admin.png"

const {ipcRenderer} = window.require("electron")

/** 首屏加载蒙层展示语 */
const LoadingTitle: string[] = [
    "没有困难的工作，只有勇敢的打工人。",
    "打工累吗？累！但我不能哭，因为骑电动车擦眼泪不安全。",
    "亲们，起床打工了！",
    "打工不仅能致富，还能交友娶媳妇",
    "今天搬砖不狠，明天地位不稳",
    "打工可能会少活十年，不打工你一天也活不下去。",
    "早点睡，打工人。",
    "有人相爱，有人夜里看海，有人七八个闹钟起不来，早安打工人!",
    "累吗，累就对了，舒服是留给有钱人的，早安，打工人!",
    "爱情不是我生活的全部，打工才是。早安，打工人。",
    "打工人，打工魂，打工人是人上人",
    "@所有人，据说用了Yakit后就不必再卷了！",
    "再不用Yakit，卷王就是别人的了",
    "来用Yakit啦？安全圈还是你最成功",
    "这届网安人，人手一个Yakit，香惨了！"
]

export const EngineModeVerbose = (m: YaklangEngineMode) => {
    switch (m) {
        case "admin":
            return "管理权限"
        case "local":
            return "普通权限"
        case "remote":
            return "远程连接"
        default:
            return "未知模式"
    }
}

export interface YakitLoadingProp {
    /** yakit模式 */
    yakitStatus?: YakitStatusType
    /** 引擎模式 */
    engineMode: YaklangEngineMode
    /** 数据库是否无权限 */
    databaseError: boolean
    /** 是否完成初始化 */
    loading: boolean
    localPort: number
    adminPort: number
    onEngineModeChange: (mode: YaklangEngineMode, keepalive?: boolean) => any
    showEngineLog: boolean
    setShowEngineLog: (flag: boolean) => any
}

export const YakitLoading: React.FC<YakitLoadingProp> = (props) => {
    const {yakitStatus, engineMode, loading, showEngineLog, setShowEngineLog, onEngineModeChange} = props

    const [system, setSystem] = useState<YakitSystem>("Darwin")

    const [download, setDownload] = useState<boolean>(false)
    const [install, setInstall] = useState<boolean>(false)

    /** 引擎模式切换弹窗 */
    const [showSwitchMode, setShowSwitchMode] = useState<boolean>(false)
    const onCancelSwitchMode = useMemoizedFn(() => setShowSwitchMode(false))

    /** 启动引擎倒计时 */
    const [__engineReady, setEngineReady, getEngineReady] = useGetState<number>(3)
    const readyTime = useRef<any>(null)
    /** 引擎日志展示倒计时 */
    const [__showLog, setShowLog, getShowLog] = useGetState<number>(0)
    const logTime = useRef<any>(null)

    /** 计时器清除 */
    const engineTimeClear = (type: "log" | "ready") => {
        if (type === "log") {
            if (logTime.current) {
                clearInterval(logTime.current)
                logTime.current = null
            }
            setShowLog(0)
        }
        if (type === "ready") {
            if (readyTime.current) {
                clearInterval(readyTime.current)
                readyTime.current = null
            }
            setEngineReady(3)
        }
    }
    /** 计时器 */
    const engineTime = useMemoizedFn((type: "log" | "ready") => {
        engineTimeClear(type)

        if (type === "log") {
            logTime.current = setInterval(() => {
                setShowLog(getShowLog() + 1)
                if (getShowLog() >= 5) {
                    clearInterval(logTime.current)
                }
            }, 1000)
        }
        if (type === "ready") {
            readyTime.current = setInterval(() => {
                setEngineReady(getEngineReady() - 1)
                if (getEngineReady() <= 0) {
                    clearInterval(readyTime.current)
                    ipcRenderer.invoke("engine-ready-link").finally(() => {
                        engineTime("log")
                    })
                }
            }, 1000)
        }
    })

    useEffect(() => {
        ipcRenderer.invoke("fetch-system-name").then((type: YakitSystem) => setSystem(type))
    }, [])

    useEffect(() => {
        if (yakitStatus === "ready") {
            engineTime("ready")
        }
        if (yakitStatus === "update") setDownload(true)
        if (yakitStatus === "install") setInstall(true)

        return () => {
            engineTimeClear("log")
            engineTimeClear("ready")
        }
    }, [yakitStatus])
    /** 是否可以连接 */
    const isReady = useMemo(() => {
        return __engineReady > 0
    }, [__engineReady])
    /** 是否展示日志按钮 */
    const isLog = useMemo(() => {
        return __showLog >= 5
    }, [__showLog])

    const selectEngineMode = useMemoizedFn((key: string) => {
        if (key === "remote" && props.onEngineModeChange) {
            props.onEngineModeChange("remote")
        }
        if (key === "local") {
            const isAdmin = props.engineMode === "admin"
            ipcRenderer
                .invoke("start-local-yaklang-engine", {
                    port: isAdmin ? props.adminPort : props.localPort,
                    sudo: isAdmin
                })
                .then(() => {
                    outputToWelcomeConsole("手动引擎启动成功！")
                    if (props.onEngineModeChange) {
                        props.onEngineModeChange(props.engineMode, true)
                    }
                })
                .catch((e) => {
                    outputToWelcomeConsole("手动引擎启动失败！")
                    outputToWelcomeConsole(`失败原因:${e}`)
                })
        }
    })

    /** 远程连接 */
    const onRemoteLink = useMemoizedFn(() => onEngineModeChange("remote"))

    /** 跳过倒计时 */
    const skipTime = useMemoizedFn(() => {
        engineTimeClear("ready")
        ipcRenderer.invoke("engine-ready-link").finally(() => {
            engineTime("log")
        })
    })
    /** 手动启动引擎 */
    const manuallyStartEngine = useMemoizedFn(() => {
        const isAdmin = props.engineMode === "admin"
        ipcRenderer
            .invoke("start-local-yaklang-engine", {
                port: isAdmin ? props.adminPort : props.localPort,
                sudo: isAdmin
            })
            .then(() => {
                outputToWelcomeConsole("手动引擎启动成功！")
                if (props.onEngineModeChange) {
                    props.onEngineModeChange(props.engineMode, true)
                }
            })
            .catch((e) => {
                outputToWelcomeConsole("手动引擎启动失败！")
                outputToWelcomeConsole(`失败原因:${e}`)
            })
            .finally(() => {
                engineTime("log")
            })
    })

    /** 加载页随机宣传语 */
    const loadingTitle = useMemo(() => LoadingTitle[Math.floor(Math.random() * (LoadingTitle.length - 0)) + 0], [])

    return (
        <div className={styles["yakit-loading-wrapper"]}>
            <div className={styles["yakit-loading-body"]}>
                <div className={styles["yakit-loading-title"]}>
                    <div className={styles["title-style"]}>欢迎使用 Yakit</div>
                    <div className={styles["subtitle-stlye"]}>{loadingTitle}</div>
                </div>

                <div className={styles["yakit-loading-icon-wrapper"]}>
                    <div className={styles["theme-icon-wrapper"]}>
                        <div className={styles["theme-icon"]}>
                            <YakitThemeLoadingSvgIcon />
                        </div>
                    </div>
                    <div className={styles["white-icon"]}>
                        <YakitLoadingSvgIcon />
                    </div>
                </div>

                <div className={styles["yakit-loading-content"]}>
                    {loading && <div className={styles["time-wait-title"]}>软件加载中</div>}
                    {!isReady && <div className={styles["time-link-title"]}>引擎连接中 ...</div>}
                    {isLog && <div className={styles["time-out-title"]}>连接超时 ...</div>}
                    {isReady && (
                        <div className={styles["time-wait-title"]}>
                            <span className={styles["time-link-title"]}>{`${__engineReady}s`}</span> 后自动连接引擎 ...
                        </div>
                    )}
                    <div className={styles["engine-log-btn"]}>
                        {isReady && (
                            <YakitButton
                                className={styles["btn-style"]}
                                size='max'
                                disabled={loading}
                                onClick={skipTime}
                            >
                                跳过倒计时
                            </YakitButton>
                        )}
                        {isLog && (
                            <YakitButton
                                className={styles["btn-style"]}
                                size='max'
                                disabled={loading}
                                onClick={manuallyStartEngine}
                            >
                                手动连接引擎
                            </YakitButton>
                        )}
                        <YakitButton
                            className={styles["btn-style"]}
                            size='max'
                            type='outline2'
                            disabled={loading}
                            onClick={() => setShowSwitchMode(true)}
                        >
                            切换连接模式
                        </YakitButton>
                        {isLog && (
                            <YakitButton
                                className={styles["btn-style"]}
                                size='max'
                                type='text'
                                onClick={() => setShowEngineLog(true)}
                            >
                                查看日志
                            </YakitButton>
                        )}
                    </div>
                </div>
            </div>
            {yakitStatus === "update" && (
                <div className={styles["yakit-loading-mask"]}>
                    <DownloadYaklang
                        system={system}
                        visible={download}
                        setVisible={setDownload}
                        onSuccess={() => {}}
                        onFailed={() => {}}
                    />
                </div>
            )}
            {yakitStatus === "install" && (
                <div className={styles["yakit-loading-mask"]}>
                    <YaklangEngineHint
                        system={system}
                        visible={install}
                        onSuccess={() => {}}
                        onRemoreLink={onRemoteLink}
                    />
                </div>
            )}
            <SwitchEngineMode
                visible={showSwitchMode}
                setVisible={onCancelSwitchMode}
                engineMode={engineMode}
                changeEngineMode={selectEngineMode}
            />
        </div>
    )
}

interface DownloadYaklangProps {
    system: YakitSystem
    visible: boolean
    setVisible: (flag: boolean) => any
    onSuccess: () => any
    onFailed: () => any
}

/** @name Yaklang引擎更新下载弹窗 */
const DownloadYaklang: React.FC<DownloadYaklangProps> = React.memo((props) => {
    const {system, visible, setVisible, onSuccess, onFailed} = props

    /** 常见问题弹窗是否展示 */
    const [qsShow, setQSShow] = useState<boolean>(false)

    /** 是否置顶 */
    const [isTop, setIsTop] = useState<0 | 1 | 2>(0)

    const [disabled, setDisabled] = useState(true)
    const [bounds, setBounds] = useState({left: 0, top: 0, bottom: 0, right: 0})
    const draggleRef = useRef<HTMLDivElement>(null)

    /** 远端最新yaklang引擎版本 */
    const [latestVersion, setLatestVersion, getLatestVersion] = useGetState("")
    /** 下载进度条数据 */
    const [downloadProgress, setDownloadProgress, getDownloadProgress] = useGetState<DownloadingState>()

    // 是否中断下载进程
    const isBreakRef = useRef<boolean>(false)

    const fetchVersion = useMemoizedFn(() => {
        isBreakRef.current = true

        ipcRenderer
            .invoke("fetch-latest-yaklang-version")
            .then((data: string) => setLatestVersion(data))
            .catch((e: any) => {
                if (!isBreakRef.current) return
                failed(`获取引擎最新版本失败 ${e}`)
                setVisible(false)
            })
            .finally(() => {
                if (!isBreakRef.current) return
                ipcRenderer
                    .invoke("download-latest-yak", getLatestVersion())
                    .then(() => {
                        if (!isBreakRef.current) return

                        success("下载完毕")
                        if (!getDownloadProgress()?.size) return
                        setDownloadProgress({
                            time: {
                                elapsed: downloadProgress?.time.elapsed || 0,
                                remaining: 0
                            },
                            speed: 0,
                            percent: 100,
                            // @ts-ignore
                            size: getDownloadProgress().size
                        })
                        onUpdate()
                    })
                    .catch((e: any) => {
                        if (!isBreakRef.current) return
                        failed(`引擎下载失败: ${e}`)
                        setVisible(false)
                    })
            })
    })

    /**
     * 1. 获取最新引擎版本号(版本号内带有'v'字符)，并下载
     * 2. 监听本地下载引擎进度数据
     */
    useEffect(() => {
        if (visible) {
            fetchVersion()

            ipcRenderer.on("download-yak-engine-progress", (e: any, state: DownloadingState) => {
                if (!isBreakRef.current) return
                setDownloadProgress(state)
            })

            return () => {
                ipcRenderer.removeAllListeners("download-yak-engine-progress")
            }
        } else {
            isBreakRef.current = false
        }
    }, [visible])

    /** 立即更新 */
    const onUpdate = useMemoizedFn(() => {
        ipcRenderer
            .invoke("install-yak-engine", latestVersion)
            .then(() => {
                success("安装成功，如未生效，重启 Yakit 即可")
                setQSShow(false)
                onSuccess()
            })
            .catch((err: any) => {
                failed(`安装失败: ${err.message.indexOf("operation not permitted") > -1 ? "请关闭引擎后重试" : err}`)
                setQSShow(false)
                onFailed()
            })
            .finally(() => {
                onInstallClose()
            })
    })

    /** 弹窗拖拽移动触发事件 */
    const onStart = useMemoizedFn((_event: DraggableEvent, uiData: DraggableData) => {
        const {clientWidth, clientHeight} = window.document.documentElement
        const targetRect = draggleRef.current?.getBoundingClientRect()
        if (!targetRect) return

        setBounds({
            left: -targetRect.left + uiData.x,
            right: clientWidth - (targetRect.right - uiData.x),
            top: -targetRect.top + uiData.y + 36,
            bottom: clientHeight - (targetRect.bottom - uiData.y)
        })
    })

    /** 取消下载事件 */
    const onInstallClose = useMemoizedFn(() => {
        isBreakRef.current = false
        setDownloadProgress(undefined)
        setQSShow(false)
        setVisible(false)
    })

    return (
        <>
            <Draggable
                defaultClassName={classnames(
                    styles["yaklang-update-modal"],
                    visible ? styles["engine-hint-modal-wrapper"] : styles["modal-hidden-wrapper"],
                    {[styles["modal-top-wrapper"]]: isTop === 0}
                )}
                disabled={disabled}
                bounds={bounds}
                onStart={(event, uiData) => onStart(event, uiData)}
            >
                <div ref={draggleRef}>
                    <div className={styles["modal-yaklang-engine-hint"]} onClick={() => setIsTop(0)}>
                        <div className={styles["yaklang-engine-hint-wrapper"]}>
                            <div
                                className={styles["hint-draggle-body"]}
                                onMouseEnter={() => {
                                    if (disabled) setDisabled(false)
                                }}
                                onMouseLeave={() => setDisabled(true)}
                                onMouseDown={() => setIsTop(0)}
                            ></div>

                            <div className={styles["hint-left-wrapper"]}>
                                <div className={styles["hint-icon"]}>
                                    <YaklangInstallHintSvgIcon />
                                </div>
                                <div
                                    className={styles["qs-icon"]}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setQSShow(true)
                                        setIsTop(2)
                                    }}
                                >
                                    <HelpSvgIcon style={{fontSize: 20}} />
                                </div>
                            </div>

                            <div className={styles["hint-right-wrapper"]}>
                                <div className={styles["hint-right-download"]}>
                                    <div className={styles["hint-right-title"]}>Yaklang 引擎下载中...</div>
                                    <div className={styles["download-progress"]}>
                                        <Progress
                                            strokeColor='#F28B44'
                                            trailColor='#F0F2F5'
                                            percent={Math.floor((downloadProgress?.percent || 0) * 100)}
                                        />
                                    </div>
                                    <div className={styles["download-info-wrapper"]}>
                                        <div>剩余时间 : {(downloadProgress?.time.remaining || 0).toFixed(2)}s</div>
                                        <div className={styles["divider-wrapper"]}>
                                            <div className={styles["divider-style"]}></div>
                                        </div>
                                        <div>耗时 : {(downloadProgress?.time.elapsed || 0).toFixed(2)}s</div>
                                        <div className={styles["divider-wrapper"]}>
                                            <div className={styles["divider-style"]}></div>
                                        </div>
                                        <div>下载速度 : {((downloadProgress?.speed || 0) / 1000000).toFixed(2)}M/s</div>
                                    </div>
                                    <div className={styles["download-btn"]}>
                                        <YakitButton
                                            size='max'
                                            type='outline2'
                                            onClick={() => {
                                                onFailed()
                                                onInstallClose()
                                            }}
                                        >
                                            取消
                                        </YakitButton>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Draggable>
            <QuestionModal isTop={isTop} setIsTop={setIsTop} system={system} visible={qsShow} setVisible={setQSShow} />
        </>
    )
})

interface YaklangEngineHintProps {
    system: YakitSystem
    visible: boolean
    onSuccess: () => any
    onRemoreLink: () => any
}

const YaklangEngineHint: React.FC<YaklangEngineHintProps> = React.memo((props) => {
    const {system, visible, onSuccess, onRemoreLink} = props

    /** 是否弹窗置顶 */
    const [isTop, setIsTop] = useState<0 | 1 | 2>(0)
    /** 用户协议弹窗是否展示 */
    const [agrShow, setAgrShow] = useState<boolean>(false)
    /** 常见文件弹窗是否展示 */
    const [qsShow, setQSShow] = useState<boolean>(false)

    const [disabled, setDisabled] = useState(true)
    const [bounds, setBounds] = useState({left: 0, top: 0, bottom: 0, right: 0})
    const draggleRef = useRef<HTMLDivElement>(null)
    /** 操作系统和架构 */
    const [platformArch, setPlatformArch] = useState<string>("")

    const [install, setInstall] = useState<boolean>(false)

    /** 用户协议勾选状态 */
    const [agrCheck, setAgrCheck] = useState<boolean>(false)
    /** 执行一键安装功能时判断用户协议状态 */
    const [checkStatus, setCheckStatus] = useState<boolean>(false)
    /** 展示抖动动画 */
    const [isShake, setIsShake] = useState<boolean>(false)

    /** 远端最新yaklang引擎版本 */
    const [__latestVersion, setLatestVersion, getLatestVersion] = useGetState("")
    /** 下载进度条数据 */
    const [downloadProgress, setDownloadProgress, getDownloadProgress] = useGetState<DownloadingState>()
    /** 是否中断下载记录 */
    const [cancelLoading, setCancelLoading] = useState<boolean>(false)
    const isBreakDownload = useRef<boolean>(false)

    /** 弹窗拖拽移动触发事件 */
    const onStart = useMemoizedFn((_event: DraggableEvent, uiData: DraggableData) => {
        const {clientWidth, clientHeight} = window.document.documentElement
        const targetRect = draggleRef.current?.getBoundingClientRect()
        if (!targetRect) return

        setBounds({
            left: -targetRect.left + uiData.x,
            right: clientWidth - (targetRect.right - uiData.x),
            top: -targetRect.top + uiData.y + 36,
            bottom: clientHeight - (targetRect.bottom - uiData.y)
        })
    })

    /**
     * 1. 获取系统-CPU架构信息
     * 2. 监听本地下载引擎进度数据
     */
    useEffect(() => {
        ipcRenderer.invoke("fetch-system-and-arch").then((e: string) => setPlatformArch(e))
        ipcRenderer.on("download-yak-engine-progress", (e: any, state: DownloadingState) => {
            if (isBreakDownload.current) return
            setDownloadProgress(state)
        })

        return () => {
            ipcRenderer.removeAllListeners("download-yak-engine-progress")
        }
    }, [])

    /** 复制功能 */
    const copyCommand = useMemoizedFn(() => {
        ipcRenderer.invoke("set-copy-clipboard", "softwareupdate --install-rosetta")
        success("复制成功")
    })

    /** 获取引擎线上最新版本 */
    const fetchEngineLatestVersion = useMemoizedFn((callback?: () => any) => {
        ipcRenderer
            .invoke("fetch-latest-yaklang-version")
            .then((data: string) => {
                if (isBreakDownload.current) return
                setLatestVersion(data.startsWith("v") ? data.slice(1) : data)
                if (callback) callback()
            })
            .catch((e: any) => {
                failed(`获取线上引擎最新版本失败 ${e}`)
                onInstallClose()
            })
    })

    const downloadEngine = useMemoizedFn(() => {
        ipcRenderer
            .invoke("download-latest-yak", `v${getLatestVersion()}`)
            .then(() => {
                if (isBreakDownload.current) return

                if (!getDownloadProgress()?.size) return
                setDownloadProgress({
                    time: {
                        elapsed: downloadProgress?.time.elapsed || 0,
                        remaining: 0
                    },
                    speed: 0,
                    percent: 100,
                    // @ts-ignore
                    size: getDownloadProgress().size
                })
                success("下载完毕")
                /** 安装yaklang引擎 */
                ipcRenderer
                    .invoke("install-yak-engine", `v${getLatestVersion()}`)
                    .then(() => {
                        success("安装成功，如未生效，重启 Yakit 即可")
                        if (isBreakDownload.current) return
                        onSuccess()
                    })
                    .catch((err: any) => {
                        failed(`安装失败: ${err}`)
                        onInstallClose()
                    })
            })
            .catch((e: any) => {
                if (isBreakDownload.current) return
                failed(`引擎下载失败: ${e}`)
                onInstallClose()
            })
    })

    /** 一键安装事件 */
    const installEngine = useMemoizedFn(() => {
        setCheckStatus(true)
        if (!agrCheck) {
            /** 抖动提示动画 */
            setIsShake(true)
            setTimeout(() => setIsShake(false), 1000)
            return
        }

        setInstall(true)

        fetchEngineLatestVersion(() => downloadEngine())
    })

    /** 取消事件 */
    const onClose = useMemoizedFn(() => {
        setCancelLoading(true)
        isBreakDownload.current = true
        setDownloadProgress(undefined)
        setTimeout(() => {
            setInstall(false)
            setCancelLoading(false)
        }, 500)
    })
    /** 取消下载事件 */
    const onInstallClose = useMemoizedFn(() => {
        isBreakDownload.current = false
        if (downloadProgress) setDownloadProgress(undefined)
        if (install) setInstall(false)
    })
    /** 远程连接 */
    const remoteLink = useMemoizedFn(() => {
        setCheckStatus(true)
        if (!agrCheck) {
            setIsShake(true)
            setTimeout(() => setIsShake(false), 1000)
            return
        }
        onRemoreLink()
    })

    return (
        <>
            <Draggable
                defaultClassName={classnames(
                    styles["yaklang-update-modal"],
                    visible ? styles["engine-hint-modal-wrapper"] : styles["modal-hidden-wrapper"],
                    {[styles["modal-top-wrapper"]]: isTop === 0}
                )}
                disabled={disabled}
                bounds={bounds}
                onStart={(event, uiData) => onStart(event, uiData)}
            >
                <div ref={draggleRef}>
                    <div className={styles["modal-yaklang-engine-hint"]} onClick={() => setIsTop(0)}>
                        <div className={styles["yaklang-engine-hint-wrapper"]}>
                            <div
                                className={styles["hint-draggle-body"]}
                                onMouseEnter={() => {
                                    if (disabled) setDisabled(false)
                                }}
                                onMouseLeave={() => setDisabled(true)}
                                onMouseDown={() => setIsTop(0)}
                            ></div>

                            <div className={styles["hint-left-wrapper"]}>
                                <div className={styles["hint-icon"]}>
                                    <YaklangInstallHintSvgIcon />
                                </div>
                                <div
                                    className={styles["qs-icon"]}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setQSShow(true)
                                        setIsTop(2)
                                    }}
                                >
                                    <HelpSvgIcon style={{fontSize: 20}} />
                                </div>
                            </div>

                            <div className={styles["hint-right-wrapper"]}>
                                {install ? (
                                    <div className={styles["hint-right-download"]}>
                                        <div className={styles["hint-right-title"]}>引擎安装中...</div>
                                        <div className={styles["download-progress"]}>
                                            <Progress
                                                strokeColor='#F28B44'
                                                trailColor='#F0F2F5'
                                                percent={Math.floor((downloadProgress?.percent || 0) * 100)}
                                            />
                                        </div>
                                        <div className={styles["download-info-wrapper"]}>
                                            <div>剩余时间 : {(downloadProgress?.time.remaining || 0).toFixed(2)}s</div>
                                            <div className={styles["divider-wrapper"]}>
                                                <div className={styles["divider-style"]}></div>
                                            </div>
                                            <div>耗时 : {(downloadProgress?.time.elapsed || 0).toFixed(2)}s</div>
                                            <div className={styles["divider-wrapper"]}>
                                                <div className={styles["divider-style"]}></div>
                                            </div>
                                            <div>
                                                下载速度 : {((downloadProgress?.speed || 0) / 1000000).toFixed(2)}M/s
                                            </div>
                                        </div>
                                        <div className={styles["download-btn"]}>
                                            <YakitButton
                                                loading={cancelLoading}
                                                size='max'
                                                type='outline2'
                                                onClick={onClose}
                                            >
                                                取消
                                            </YakitButton>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className={styles["hint-right-title"]}>未安装引擎</div>
                                        <div className={styles["hint-right-content"]}>
                                            你可选择安装 Yak 引擎启动软件，或远程连接启动
                                        </div>

                                        {platformArch === "darwin-arm64" && (
                                            <div className={styles["hint-right-macarm"]}>
                                                <div>
                                                    <div className={styles["mac-arm-hint"]}>
                                                        当前系统为(darwin-arm64)，如果未安装 Rosetta 2, 将无法运行 Yak
                                                        核心引擎
                                                        <br />
                                                        运行以下命令可手动安装 Rosetta，如已安装可忽略
                                                    </div>
                                                    <div className={styles["mac-arm-command"]}>
                                                        softwareupdate --install-rosetta
                                                        <div className={styles["copy-icon"]} onClick={copyCommand}>
                                                            <YakitCopySvgIcon />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div
                                            className={classnames(styles["hint-right-agreement"], {
                                                [styles["agr-shake-animation"]]: !agrCheck && isShake
                                            })}
                                        >
                                            <Checkbox
                                                className={classnames(
                                                    {[styles["agreement-checkbox"]]: !(!agrCheck && checkStatus)},
                                                    {
                                                        [styles["agreement-danger-checkbox"]]: !agrCheck && checkStatus
                                                    }
                                                )}
                                                checked={agrCheck}
                                                onChange={(e) => setAgrCheck(e.target.checked)}
                                            ></Checkbox>
                                            <span>
                                                勾选同意{" "}
                                                <span
                                                    className={styles["agreement-style"]}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setAgrShow(true)
                                                        setIsTop(1)
                                                    }}
                                                >
                                                    《用户协议》
                                                </span>
                                            </span>
                                        </div>

                                        <div className={styles["hint-right-btn"]}>
                                            <div>
                                                <YakitButton size='max' type='outline2' onClick={remoteLink}>
                                                    远程连接
                                                </YakitButton>
                                            </div>
                                            <div className={styles["btn-group-wrapper"]}>
                                                <YakitButton
                                                    size='max'
                                                    type='outline2'
                                                    onClick={() => ipcRenderer.invoke("UIOperate", "close")}
                                                >
                                                    取消
                                                </YakitButton>
                                                <YakitButton size='max' onClick={installEngine}>
                                                    一键安装
                                                </YakitButton>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </Draggable>
            <AgreementContentModal
                isTop={isTop}
                setIsTop={setIsTop}
                system={system}
                visible={agrShow}
                setVisible={setAgrShow}
            />
            <QuestionModal isTop={isTop} setIsTop={setIsTop} system={system} visible={qsShow} setVisible={setQSShow} />
        </>
    )
})

interface AgrAndQSModalProps {
    isTop: 0 | 1 | 2
    setIsTop: (type: 0 | 1 | 2) => any
    system: YakitSystem
    visible: boolean
    setVisible: (flag: boolean) => any
}

/** @name 用户协议弹窗 */
const AgreementContentModal: React.FC<AgrAndQSModalProps> = React.memo((props) => {
    const {isTop, setIsTop, system, visible, setVisible} = props

    const [show, setShow] = useState<boolean>(false)

    const [disabled, setDisabled] = useState(true)
    const [bounds, setBounds] = useState({left: 0, top: 0, bottom: 0, right: 0})
    const draggleRef = useRef<HTMLDivElement>(null)

    const onStart = useMemoizedFn((_event: DraggableEvent, uiData: DraggableData) => {
        const {clientWidth, clientHeight} = window.document.documentElement
        const targetRect = draggleRef.current?.getBoundingClientRect()
        if (!targetRect) return

        setBounds({
            left: -targetRect.left + uiData.x,
            right: clientWidth - (targetRect.right - uiData.x),
            top: -targetRect.top + uiData.y + 36,
            bottom: clientHeight - (targetRect.bottom - uiData.y)
        })
    })

    return (
        <Draggable
            defaultClassName={classnames(
                styles["yakit-agr-modal"],
                {[styles["modal-top-wrapper"]]: isTop === 1},
                visible ? styles["agr-and-qs-modal-wrapper"] : styles["modal-hidden-wrapper"]
            )}
            disabled={disabled}
            bounds={bounds}
            onStart={(event, uiData) => onStart(event, uiData)}
        >
            <div ref={draggleRef}>
                <div className={styles["yakit-agr-and-qs-modal"]} onClick={() => setIsTop(1)}>
                    <div className={styles["agreement-content-modal-wrapper"]}>
                        {system === "Darwin" ? (
                            <div
                                className={classnames(styles["modal-header"], styles["mac-header"])}
                                onMouseEnter={() => {
                                    if (disabled) setDisabled(false)
                                }}
                                onMouseLeave={() => setDisabled(true)}
                                onMouseDown={() => setIsTop(1)}
                            >
                                <div
                                    className={styles["close-wrapper"]}
                                    onMouseEnter={() => setShow(true)}
                                    onMouseLeave={() => setShow(false)}
                                    onClick={() => setVisible(false)}
                                >
                                    {show ? (
                                        <MacUIOpCloseSvgIcon />
                                    ) : (
                                        <div className={styles["close-btn"]}>
                                            <div className={styles["btn-icon"]}></div>
                                        </div>
                                    )}
                                </div>
                                <span>用户协议</span>
                            </div>
                        ) : (
                            <div
                                className={classnames(styles["modal-header"], styles["win-header"])}
                                onMouseOver={() => {
                                    if (disabled) setDisabled(false)
                                }}
                                onMouseOut={() => setDisabled(true)}
                                onMouseDown={() => setIsTop(1)}
                            >
                                <span className={styles["header-title"]}>用户协议</span>
                                <div className={styles["close-wrapper"]} onClick={() => setVisible(false)}>
                                    <WinUIOpCloseSvgIcon className={styles["icon-style"]} />
                                </div>
                            </div>
                        )}
                        <div className={styles["modal-body"]}>
                            <div className={styles["body-title"]}>免责声明</div>
                            <div className={styles["body-content"]}>
                                1. 本工具仅面向 <span className={styles["sign-content"]}>合法授权</span>{" "}
                                的企业安全建设行为与个人学习行为，如您需要测试本工具的可用性，请自行搭建靶机环境。
                                <br />
                                2. 在使用本工具进行检测时，您应确保该行为符合当地的法律法规，并且已经取得了足够的授权。
                                <span className={styles["underline-content"]}>请勿对非授权目标进行扫描。</span>
                                <br />
                                3. 禁止对本软件实施逆向工程、反编译、试图破译源代码，植入后门传播恶意软件等行为。
                                <br />
                                <span className={styles["sign-bold-content"]}>
                                    如果发现上述禁止行为，我们将保留追究您法律责任的权利。
                                </span>
                                <br />
                                如您在使用本工具的过程中存在任何非法行为，您需自行承担相应后果，我们将不承担任何法律及连带责任。
                                <br />
                                在安装并使用本工具前，请您{" "}
                                <span className={styles["sign-bold-content"]}>务必审慎阅读、充分理解各条款内容。</span>
                                <br />
                                限制、免责条款或者其他涉及您重大权益的条款可能会以{" "}
                                <span className={styles["sign-bold-content"]}>加粗</span>、
                                <span className={styles["underline-content"]}>加下划线</span>
                                等形式提示您重点注意。
                                <br />
                                除非您已充分阅读、完全理解并接受本协议所有条款，否则，请您不要安装并使用本工具。您的使用行为或者您以其他任何明示或者默示方式表示接受本协议的，即视为您已阅读并同意本协议的约束。
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Draggable>
    )
})
/** @name Yaklang-常见问题弹窗 */
const QuestionModal: React.FC<AgrAndQSModalProps> = React.memo((props) => {
    const {isTop, setIsTop, system, visible, setVisible} = props

    const [show, setShow] = useState<boolean>(false)
    const [latestVersion, setLatestVersion] = useState("")

    const [disabled, setDisabled] = useState(true)
    const [bounds, setBounds] = useState({left: 0, top: 0, bottom: 0, right: 0})
    const draggleRef = useRef<HTMLDivElement>(null)

    const copyCommand = useMemoizedFn((type: YakitSystem) => {
        let link: string = ""
        switch (type) {
            case "Darwin":
                link = `https://yaklang.oss-cn-beijing.aliyuncs.com/yak/${latestVersion || "latest"}/yak_darwin_amd64`
                break
            case "Linux":
                link = `https://yaklang.oss-cn-beijing.aliyuncs.com/yak/${latestVersion || "latest"}/yak_linux_amd64`
                break
            case "Windows_NT":
                link = `https://yaklang.oss-cn-beijing.aliyuncs.com/yak/${
                    latestVersion || "latest"
                }/yak_windows_amd64.exe`
                break
        }
        ipcRenderer.invoke("set-copy-clipboard", link)
        success("复制成功")
    })

    useEffect(() => {
        ipcRenderer
            .invoke("fetch-latest-yaklang-version")
            .then((data: string) => setLatestVersion(data.startsWith("v") ? data.slice(1) : data))
            .catch((e: any) => {})
    }, [])

    const onStart = useMemoizedFn((_event: DraggableEvent, uiData: DraggableData) => {
        const {clientWidth, clientHeight} = window.document.documentElement
        const targetRect = draggleRef.current?.getBoundingClientRect()
        if (!targetRect) return

        setBounds({
            left: -targetRect.left + uiData.x,
            right: clientWidth - (targetRect.right - uiData.x),
            top: -targetRect.top + uiData.y + 36,
            bottom: clientHeight - (targetRect.bottom - uiData.y)
        })
    })

    return (
        <Draggable
            defaultClassName={classnames(
                styles["yaklang-qs-modal"],
                {[styles["modal-top-wrapper"]]: isTop === 2},
                visible ? styles["agr-and-qs-modal-wrapper"] : styles["modal-hidden-wrapper"]
            )}
            disabled={disabled}
            bounds={bounds}
            onStart={(event, uiData) => onStart(event, uiData)}
        >
            <div ref={draggleRef}>
                <div className={styles["yakit-agr-and-qs-modal"]} onClick={() => setIsTop(2)}>
                    <div className={styles["question-modal-wrapper"]}>
                        {system === "Darwin" ? (
                            <div
                                className={classnames(styles["modal-header"], styles["mac-header"])}
                                onMouseEnter={() => {
                                    if (disabled) setDisabled(false)
                                }}
                                onMouseLeave={() => setDisabled(true)}
                                onMouseDown={() => setIsTop(2)}
                            >
                                <div
                                    className={styles["close-wrapper"]}
                                    onMouseEnter={() => setShow(true)}
                                    onMouseLeave={() => setShow(false)}
                                    onClick={() => setVisible(false)}
                                >
                                    {show ? (
                                        <MacUIOpCloseSvgIcon />
                                    ) : (
                                        <div className={styles["close-btn"]}>
                                            <div className={styles["btn-icon"]}></div>
                                        </div>
                                    )}
                                </div>
                                <span>Yak 核心引擎下载链接</span>
                            </div>
                        ) : (
                            <div
                                className={classnames(styles["modal-header"], styles["win-header"])}
                                onMouseOver={() => {
                                    if (disabled) setDisabled(false)
                                }}
                                onMouseOut={() => setDisabled(true)}
                                onMouseDown={() => setIsTop(2)}
                            >
                                <span className={styles["header-title"]}>Yak 核心引擎下载链接</span>
                                <div className={styles["close-wrapper"]} onClick={() => setVisible(false)}>
                                    <WinUIOpCloseSvgIcon className={styles["icon-style"]} />
                                </div>
                            </div>
                        )}
                        <div className={styles["modal-body"]}>
                            <div className={styles["body-hint"]}>
                                <span className={styles["hint-sign"]}>如遇网络问题无法下载，可手动下载安装：</span>
                                <br />
                                Windows 用户可以把引擎放在 %HOME%/yakit-projects/yak-engine/yak.exe 即可识别 MacOS /
                                Linux 用户可以把引擎放在 ~/yakit-projects/yak-engine/yak 即可识别
                            </div>

                            <div className={styles["body-link"]}>
                                <div className={styles["link-opt"]}>
                                    <div style={{width: 107}} className={styles["link-title"]}>
                                        Windows(x64)下载
                                    </div>
                                    <div className={styles["link-style"]}>
                                        https://yaklang.oss-cn-beijing.aliyuncs.com/yak/{latestVersion || "latest"}
                                        /yak_windows_amd64.exe
                                        <div className={styles["copy-icon"]} onClick={() => copyCommand("Windows_NT")}>
                                            <YakitCopySvgIcon />
                                        </div>
                                    </div>
                                </div>
                                <div className={styles["link-opt"]}>
                                    <div style={{width: 122}} className={styles["link-title"]}>
                                        MacOS(intel/m1)下载
                                    </div>
                                    <div className={styles["link-style"]}>
                                        https://yaklang.oss-cn-beijing.aliyuncs.com/yak/{latestVersion || "latest"}
                                        /yak_darwin_amd64
                                        <div className={styles["copy-icon"]} onClick={() => copyCommand("Darwin")}>
                                            <YakitCopySvgIcon />
                                        </div>
                                    </div>
                                </div>
                                <div className={styles["link-opt"]}>
                                    <div style={{width: 87}} className={styles["link-title"]}>
                                        Linux(x64)下载
                                    </div>
                                    <div className={styles["link-style"]}>
                                        https://yaklang.oss-cn-beijing.aliyuncs.com/yak/{latestVersion || "latest"}
                                        /yak_linux_amd64
                                        <div className={styles["copy-icon"]} onClick={() => copyCommand("Linux")}>
                                            <YakitCopySvgIcon />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Draggable>
    )
})

interface SwitchEngineModeProps {
    visible: boolean
    setVisible: (visible: boolean) => any
    engineMode: YaklangEngineMode
    changeEngineMode: (mode: string) => any
}
/** @name 引擎模式切换弹窗 */
const SwitchEngineMode: React.FC<SwitchEngineModeProps> = React.memo((props) => {
    const {visible, setVisible, engineMode, changeEngineMode} = props

    return (
        <YakitModal
            visible={visible}
            onCancel={() => setVisible(false)}
            width={332}
            zIndex={1001}
            footer={null}
            centered={true}
        >
            <div className={styles["switch-engine-mode-wrapper"]}>
                <div className={styles["body-header"]}>
                    <div className={styles["header-title"]}>切换连接模式</div>
                    <div className={styles["header-close"]} onClick={() => setVisible(false)}>
                        <RemoveIcon className={styles["close-icon"]} />
                    </div>
                </div>
                <div className={styles["body-current-mode"]}>{`当前为：${EngineModeVerbose(engineMode)}`}</div>
                <div className={styles["body-mode-list"]}>
                    {engineMode !== "local" && (
                        <div className={styles["list-opt"]} onClick={() => changeEngineMode("local")}>
                            <img src={localImg} className={styles["opt-img"]} />
                            <div className={styles["opt-mode"]}>
                                <div className={styles["mode-title"]}>普通权限</div>
                                <div className={styles["mode-content"]}>以普通权限启动引擎并连接</div>
                            </div>
                        </div>
                    )}
                    {engineMode !== "admin" && (
                        <div className={styles["list-opt"]} onClick={() => changeEngineMode("admin")}>
                            <img src={adminImg} className={styles["opt-img"]} />
                            <div className={styles["opt-mode"]}>
                                <div className={styles["mode-title"]}>管理员</div>
                                <div className={styles["mode-content"]}>以管理员权限启动引擎并连接</div>
                            </div>
                        </div>
                    )}
                    {engineMode !== "remote" && (
                        <div className={styles["list-opt"]} onClick={() => changeEngineMode("remote")}>
                            <img src={remoteImg} className={styles["opt-img"]} />
                            <div className={styles["opt-mode"]}>
                                <div className={styles["mode-title"]}>远程模式</div>
                                <div className={styles["mode-content"]}>以远程方式连接引擎</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </YakitModal>
    )
})
