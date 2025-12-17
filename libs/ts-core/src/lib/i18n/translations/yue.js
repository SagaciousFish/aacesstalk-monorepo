module.exports = {
    SignIn: {
        InsertNumber: "請輸入你嘅通行碼。",
        SignIn: "登入",
        Authorizing: "登入中...",
        Errors: {
            ServerNotResponding: "伺服器暫時無回應，請稍後再試。",
            WrongCredential: "請檢查通行碼是否正確。",
            UnknownError: "登入失敗，請聯絡研究人員。"
        },
        ConfirmSignOut: "你確定要登出嗎？",
        SignOut: "登出",
        Cancel: "取消"
    },
    TopicSelection: {
        Title: "今日我哋傾啲咩？",
        Plan: "今日嘅計劃係乜嘢？",
        Recall: "今日發生咗啲乜嘢？",
        FreeTemplate: "{child_name} 鍾意嘅嘢",
        StarCount: "查看已獲得嘅顆星"
    },
    DyadInfo: {
        FamilyLabelTemplate: "{child_name} 同 {parent_type}",
        ParentType: {
            mother: "媽媽",
            father: "爸爸"
        }
    },
    Session: {
        StartingMessage: {
            PlanTemplate: "圍繞 {child_name} 今日嘅計劃開始傾計。",
            RecallTemplate: "圍繞 {child_name} 今日嘅經歷開始傾計。",
            FreeTemplate: "圍繞 {child_name} 鍾意嘅話題開始傾計。"
        },
        LoadingMessage: {
            Initializing: "初始化中...",
            ParentGuide: "生成對話指引中...",
            ChildCardsTemplate: "為 {child_name} 揀卡中...",
            RefreshChildCards: "準備新卡中...",
            ParentExample: "生成範例句子中..."
        },
        EndingMessage: "剛才係一次好精彩嘅對話！",
        Menu: {
            NextTurn: "換人講",
            TerminateSession: "結束對話",
            ConfirmTermination: "你確定要結束而家呢段對話嗎？",
            TerminateAndSave: "儲存並結束",
            TerminateWithoutSave: "唔儲存並結束",
            CancelTermination: "取消",
            GoHome: "返主頁"
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