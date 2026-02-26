module.exports = {
    SignIn: {
        InsertNumber: "请输入通行码。",
        SignIn: "登录",
        Authorizing: "正在登录...",
        Errors: {
            ServerNotResponding: "服务器当前无法连接，稍后再试。",
            WrongCredential: "请检查通行码是否正确。",
            UnknownError: "登录失败，请联系研究人员。"
        },
        ConfirmSignOut: "您确定要退出登录吗？",
        SignOut: "退出登录",
        Cancel: "取消"
    },
    TopicSelection: {
        Title: "今天我们聊些什么？",
        Plan: "今天的计划是什么？",
        Recall: "今天发生了什么？",
        FreeTemplate: "关于 {child_name} 喜欢的事情",
        StarCount: "查看获得的星星"
    },
    DyadInfo: {
        FamilyLabelTemplate: "{child_name} 和 {parent_type}",
        ParentType: {
            mother: "妈妈",
            father: "爸爸"
        }
    },
    Session: {
        StartingMessage: {
            PlanTemplate: "围绕 {child_name} 今天的计划开始对话。",
            RecallTemplate: "围绕 {child_name} 今天的经历开始对话。",
            FreeTemplate: "围绕 {child_name} 感兴趣的话题开始对话。"
        },
        LoadingMessage: {
            Initializing: "正在初始化...",
            ParentGuide: "正在生成对话引导...",
            ChildCardsTemplate: "正在为 {child_name} 选择卡片...",
            RefreshChildCards: "正在准备新卡片...",
            ParentExample: "正在生成示例句子..."
        },
        EndingMessage: "这是一次很棒的对话！",
        Menu: {
            NextTurn: "下一回合",
            TerminateSession: "结束对话",
            ConfirmTermination: "您确定要结束当前对话吗？",
            TerminateAndSave: "保存并结束",
            TerminateWithoutSave: "不保存并结束",
            CancelTermination: "取消",
            GoHome: "返回首页"
        },
        Cards: {
            Category: {
                topic: "话题",
                action: "行为",
                emotion: "情绪"
            }
        }
    }
}