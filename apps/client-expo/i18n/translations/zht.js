module.exports = {
    SignIn: {
        InsertNumber: "請輸入通行碼。",
        SignIn: "登入",
        Authorizing: "登入中...",
        Errors: {
            ServerNotResponding: "伺服器暫時無法連接，請稍後再試。",
            WrongCredential: "請確認通行碼是否正確。",
            UnknownError: "登入失敗，請聯絡研究人員。"
        },
        ConfirmSignOut: "您確定要登出嗎？",
        SignOut: "登出",
        Cancel: "取消"
    },
    TopicSelection: {
        Title: "今天我們聊些什麼？",
        Plan: "今天的計劃是什麼？",
        Recall: "今天發生了什麼？",
        FreeTemplate: "關於 {child_name} 喜歡的事情",
        StarCount: "查看獲得的星星"
    },
    DyadInfo: {
        FamilyLabelTemplate: "{child_name} 和 {parent_type}",
        ParentType: {
            mother: "媽媽",
            father: "爸爸"
        }
    },
    Session: {
        StartingMessage: {
            PlanTemplate: "圍繞 {child_name} 今天的計劃開始對話。",
            RecallTemplate: "圍繞 {child_name} 今天的經歷開始對話。",
            FreeTemplate: "圍繞 {child_name} 感興趣的話題開始對話。"
        },
        LoadingMessage: {
            Initializing: "正在初始化...",
            ParentGuide: "正在生成對話引導...",
            ChildCardsTemplate: "正在為 {child_name} 選擇卡片...",
            RefreshChildCards: "正在準備新卡片...",
            ParentExample: "正在生成示例句子..."
        },
        EndingMessage: "這是一次很棒的對話！",
        Menu: {
            NextTurn: "下一回合",
            TerminateSession: "結束對話",
            ConfirmTermination: "您確定要結束當前對話嗎？",
            TerminateAndSave: "儲存並結束",
            TerminateWithoutSave: "不儲存並結束",
            CancelTermination: "取消",
            GoHome: "返回首頁"
        },
        Cards: {
            Category: {
                topic: "話題",
                action: "行為",
                emotion: "情緒"
            }
        }
    }
}
