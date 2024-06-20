// 定义允许的标签
const allowedTags = new Set(["p", "span", "div", "b", "i", "strong", "em", "a"])

// 定义允许的属性
const allowedAttributes = new Set(["href", "style"])

export const sanitizeHTML = (inputHTML: string) => {
    // bun
    const rewriter = new HTMLRewriter()
    rewriter.on("*", {
        element(element) {
            const tagName = element.tagName.toLowerCase()
            console.log(tagName)
            if (!allowedTags.has(tagName)) {
                element.remove()
            } else {
                for (const [name] of element.attributes) {
                    if (!allowedAttributes.has(name.toLowerCase())) {
                        element.removeAttribute(name)
                    }
                }
            }
        },
    })
    return rewriter.transform(inputHTML)
}
