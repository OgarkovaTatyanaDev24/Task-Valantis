function generateHash() {
    const format = (date) => date < 10 ? `0${date}` : date.toString();
    const date = new Date();
    const day = date.getUTCDate();
    const month = date.getUTCMonth() + 1;
    const year = date.getUTCFullYear();
    const dateStr = `${year}${format(month)}${format(day)}`;
    return CryptoJS.MD5(`Valantis_${dateStr}`);
}

async function makeRequest(action, params) {
    while (true) {
        let response = await fetch("https://api.valantis.store:41000/", {
            method: "POST",
            headers: {
                "X-Auth": generateHash(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "action": action,
                "params": params
            })
        });
        if (response.ok) {
            return (await response.json()).result
        }
        else {
            const text = await response.text();
            console.log(`Request error with code: ${response.status} and text: ${text}`);
        }
    }
}

/**
 * Represents a Products.
 * The Products class receives a list of products, draws them, and contains filtering and search logic.
 */
class Products {
    /**
 * @param {[number]} offests - Shift elements.
 * @param {number} currentPage - Current page number.
 * @param {number} pageLen - Page length.
 */
    constructor(offests = [0], currentPage = 0, pageLen = 50) {
        this.offests = offests;
        this.currentPage = currentPage;
        this.pageLen = pageLen;
        // const offests = [0]
        // let currentPage = 0
    }

    /**
     * Gets a list of product IDs.
     * @returns {[string]}
     */
    async getProductsId() {
        if (this.offests.length > this.currentPage + 1) {
            const result = await makeRequest(
                "get_ids",
                { "offset": this.offests[this.currentPage], "limit": this.offests[this.currentPage + 1] - this.offests[this.currentPage] },
            )
            return new Array(...new Set(result))
        }
        else {
            const resp = await makeRequest(
                "get_ids",
                { "offset": this.offests[this.currentPage], "limit": this.pageLen * 2 },
            )
            const [result, offset] = this.filterIds(resp)
            this.offests.push(this.offests[this.currentPage] + offset + 1)
            return result
        }
    }
    /**
* Filters products with the same IDs.
* @param {[string]} ids Array of IDs.
* @returns {[object]} Array of unique IDs with length equals pagLen.
*/
    filterIds(ids) {
        const res = new Set()
        for (let i = 0; i < ids.length; i++) {
            res.add(ids[i])
            if (res.size === this.pageLen && ids[i] !== ids[i - 1]) return [new Array(...res), i]
        }
    }
    /**
 * Gets additional product parameters.
 * @param {[string]} productsIds - list of product IDs.
 * @returns {[object]} Filtered list of products characteristics.
 */
    async getProductsDesc(productsIds) {
        const response = await makeRequest(
            "get_items",
            { "ids": (productsIds) },
        )
        return this.removeDublicates(response)
    }
    /**
* Filters products with the same parameters.
* @param {[object]} products Array of products.
* @returns {[object]} Array of products.
*/
    removeDublicates(products) {
        const idSet = new Set();
        return products.filter((el) => {
            if (!idSet.has(el["id"])) {
                idSet.add(el.id)
                return true
            }
        })
    }
    /**
* Draws product cards.
* @param {[string]} productsIds Array of IDs.
*/
    async drawProducts(productsIds) {
        const productsEl = document.querySelector(".products")
        const data = await this.getProductsDesc(productsIds)

        // Clearing previous cards.
        productsEl.innerHTML = ""

        data.forEach((item) => {
            const productEl = document.createElement("div")
            productEl.classList.add("product")
            productEl.innerHTML = `
                        <h2>${item.product}</h2>
                        <p><span class="bold">Price:</span> ${item.price}</p>
                        <p><span class="bold">Brand:</span> ${item.brand}</p>
                        <p><span class="bold">Id:</span> ${item.id}</p>`
            productsEl.appendChild(productEl)
        })
    }
    /**
* Shows products filtered by filter form cards.
*/
    async showFilteredProducts() {
        const pagination = document.getElementById("pagination");
        pagination.style.display = "none";
        const productsIds = await this.getFilteredProducts()
        await this.drawProducts(productsIds)
    }
    /**
* Shows products filtered by filter form cards.
*/
    async showPaginatedProducts() {
        const pagination = document.getElementById("pagination");
        const btnPrev = document.getElementById("prev");
        const btnNext = document.getElementById("next");
        btnPrev.disabled = true;
        btnNext.disabled = true;
        const productsIds = await this.getProductsId()
        await this.drawProducts(productsIds)
        const currentPage = document.getElementById("curPage");
        currentPage.innerHTML = this.currentPage + 1;
        pagination.style.display = "flex";
        btnPrev.disabled = false;
        btnNext.disabled = false;
    }

    /**
 * Draws paginated product cards without filtering.
 * @param {boolean} filter - Filtration state.
 */
    async showProducts(filter = false) {
        const preloader = document.getElementById("preloader");
        preloader.style.display = "flex";
        if (filter) await this.showFilteredProducts();
        else await this.showPaginatedProducts();
        preloader.style.display = "none";
    }

    // Setup pagination.
    pagination() {
        const showPreviosPage = () => {
            if (this.currentPage >= 1) {
                this.currentPage--;
                this.showProducts();
            }
        }

        const showNextPage = () => {
            this.currentPage++;
            this.showProducts();
        }

        document.getElementById("prev").addEventListener("click", (event) => showPreviosPage())
        document.getElementById("next").addEventListener("click", (event) => showNextPage())
    }
    // Search filtered products.
    search() {
        const searchButton = document.getElementById("searchButton");

        const inputs = document.querySelectorAll(".input-text");
        inputs.forEach((elem) => {
            elem.addEventListener("input", () => {
                if (elem.value.length < 3) {
                    searchButton.setAttribute("disabled", true);
                } else {
                    searchButton.removeAttribute("disabled");
                }
            })
        })

        const form = document.getElementById("filter-form")
        form.addEventListener("submit", (event) => {
            event.preventDefault()
            this.showProducts(event.submitter.id === "searchButton")
        })
    }
    /**
* Gets filtered products.
* @returns {[string]} List of filtered products with a unique id.
*/
    async getFilteredProducts() {
        const inpProduct = document.getElementById("product-input");
        const inpBrand = document.getElementById("brand-input");
        const inpPrice = document.getElementById("price-input");
        this.currentPage = 0;
        const params = {}
        if (inpProduct.value) params["product"] = `${inpProduct.value}`
        if (inpBrand.value) params["brand"] = `${inpBrand.value}`
        if (inpPrice.value) params["price"] = parseFloat(inpPrice.value)
        if (Object.keys(params).length) {
            const response = await makeRequest(
                "filter",
                params,
            )
            return new Array(... new Set(response))
        }
        return []
    }
}

function setUp() {
    const products = new Products();
    products.showProducts();
    products.search();
    products.pagination();

    // Filter button
    const filterBtn = document.getElementById("filter")

    filterBtn.addEventListener("click", () => document.querySelector("header").classList.toggle("open"))
}

setUp()
