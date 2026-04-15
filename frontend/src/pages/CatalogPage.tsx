import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useCategoriesQuery,
  useCreateProductMutation,
  useProductsQuery,
  useSeedMutation
} from "../hooks/queries";
import { useFilterStore } from "../store/filters";

const parseAttributeValue = (rawValue: string): string | number | boolean => {
  const value = rawValue.trim();
  const lower = value.toLowerCase();

  if (lower === "true") {
    return true;
  }

  if (lower === "false") {
    return false;
  }

  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) {
    return asNumber;
  }

  return value;
};

export const CatalogPage = () => {
  const {
    category,
    search,
    priceMin,
    priceMax,
    inStock,
    sort,
    offset,
    limit,
    attributes,
    setCategory,
    setSearch,
    setPriceMin,
    setPriceMax,
    setInStock,
    setSort,
    setOffset,
    setLimit,
    setAttribute,
    clearAttributes,
    reset
  } = useFilterStore();

  const [attributeKey, setAttributeKey] = useState("");
  const [attributeValue, setAttributeValue] = useState("");
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createSku, setCreateSku] = useState("");
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createCategory, setCreateCategory] = useState("");
  const [createPrice, setCreatePrice] = useState("");
  const [createStock, setCreateStock] = useState("");
  const [createTags, setCreateTags] = useState("");
  const [createAttributeKey, setCreateAttributeKey] = useState("");
  const [createAttributeValue, setCreateAttributeValue] = useState("");
  const [createAttributes, setCreateAttributes] = useState<Record<string, string>>({});
  const [createFormError, setCreateFormError] = useState("");

  const productsQuery = useProductsQuery();
  const categoriesQuery = useCategoriesQuery();
  const seedMutation = useSeedMutation();
  const createProductMutation = useCreateProductMutation();

  const activeAttributes = useMemo(
    () => Object.entries(attributes).filter(([, value]) => value.trim() !== ""),
    [attributes]
  );

  const onAddAttributeFilter = (event: FormEvent) => {
    event.preventDefault();
    const key = attributeKey.trim();
    const value = attributeValue.trim();

    if (!key || !value) {
      return;
    }

    setAttribute(key, value);
    setAttributeKey("");
    setAttributeValue("");
  };

  const resetCreateProductForm = () => {
    setCreateSku("");
    setCreateName("");
    setCreateDescription("");
    setCreateCategory("");
    setCreatePrice("");
    setCreateStock("");
    setCreateTags("");
    setCreateAttributeKey("");
    setCreateAttributeValue("");
    setCreateAttributes({});
    setCreateFormError("");
  };

  const openCreateDialog = () => {
    createProductMutation.reset();
    resetCreateProductForm();
    setIsCreateDialogOpen(true);
  };

  const closeCreateDialog = () => {
    if (createProductMutation.isPending) {
      return;
    }

    setIsCreateDialogOpen(false);
  };

  const onAddCreateAttribute = () => {
    const key = createAttributeKey.trim();
    const value = createAttributeValue.trim();

    if (!key || !value) {
      return;
    }

    setCreateAttributes((prev) => ({
      ...prev,
      [key]: value
    }));
    setCreateAttributeKey("");
    setCreateAttributeValue("");
  };

  const onSubmitCreateProduct = async (event: FormEvent) => {
    event.preventDefault();
    setCreateFormError("");

    const sku = createSku.trim();
    const name = createName.trim();
    const description = createDescription.trim();
    const categoryName = createCategory.trim();
    const price = Number(createPrice);
    const stock = Number(createStock);

    if (!sku || !name || !description || !categoryName) {
      setCreateFormError("Bitte fuelle alle Pflichtfelder aus.");
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      setCreateFormError("Preis muss eine gueltige Zahl >= 0 sein.");
      return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      setCreateFormError("Stock muss eine ganze Zahl >= 0 sein.");
      return;
    }

    const tags = createTags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    const preparedAttributes = Object.entries(createAttributes).reduce<Record<string, string | number | boolean>>(
      (acc, [key, value]) => {
        if (value.trim() === "") {
          return acc;
        }

        acc[key] = parseAttributeValue(value);
        return acc;
      },
      {}
    );

    await createProductMutation.mutateAsync({
      sku,
      name,
      description,
      price,
      category: categoryName,
      stock,
      tags,
      attributes: preparedAttributes
    });

    setIsCreateDialogOpen(false);
    resetCreateProductForm();
  };

  const pagination = productsQuery.data?.pagination;

  return (
    <section className="page-grid">
      <aside className="filters-panel card">
        <h2>Filter</h2>

        <label>
          Kategorie
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Alle Kategorien</option>
            {categoriesQuery.data?.data.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          Suchbegriff
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="z.B. laptop"
          />
        </label>

        <div className="price-row">
          <label>
            Preis min
            <input type="number" value={priceMin} onChange={(event) => setPriceMin(event.target.value)} />
          </label>
          <label>
            Preis max
            <input type="number" value={priceMax} onChange={(event) => setPriceMax(event.target.value)} />
          </label>
        </div>

        <label>
          Sortierung
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="-created_at">Neueste zuerst</option>
            <option value="price">Preis aufsteigend</option>
            <option value="-price">Preis absteigend</option>
            <option value="name">Name A-Z</option>
          </select>
        </label>

        <label className="checkbox-row">
          <input type="checkbox" checked={inStock} onChange={(event) => setInStock(event.target.checked)} />
          Nur verfuegbare Produkte
        </label>

        <form onSubmit={onAddAttributeFilter} className="attribute-form">
          <p>Dynamischer Attributfilter</p>
          <input
            type="text"
            value={attributeKey}
            onChange={(event) => setAttributeKey(event.target.value)}
            placeholder="z.B. ram_gb"
          />
          <input
            type="text"
            value={attributeValue}
            onChange={(event) => setAttributeValue(event.target.value)}
            placeholder="z.B. 16"
          />
          <button type="submit">Attribut setzen</button>
        </form>

        {activeAttributes.length > 0 && (
          <div className="chips">
            {activeAttributes.map(([key, value]) => (
              <button key={key} onClick={() => setAttribute(key, "")} className="chip" type="button">
                {key}:{value} x
              </button>
            ))}
          </div>
        )}

        <div className="filter-actions">
          <button type="button" onClick={() => clearAttributes()}>
            Attribute leeren
          </button>
          <button type="button" onClick={() => reset()}>
            Alles zuruecksetzen
          </button>
        </div>

        <div className="seed-box">
          <p>Demo-Daten</p>
          <button type="button" onClick={() => seedMutation.mutate(140)} disabled={seedMutation.isPending}>
            {seedMutation.isPending ? "Seeding..." : "Seed neu erzeugen"}
          </button>
        </div>
      </aside>

      <section className="card">
        <div className="catalog-head">
          <h2>Produktkatalog</h2>
          <div className="catalog-controls">
            <label>
              Limit
              <select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={40}>40</option>
              </select>
            </label>

            <label className="checkbox-row admin-toggle">
              <input
                type="checkbox"
                checked={isAdminMode}
                onChange={(event) => setIsAdminMode(event.target.checked)}
              />
              Admin-Modus
            </label>

            {isAdminMode && (
              <button type="button" className="primary-action" onClick={openCreateDialog}>
                Produkt erstellen
              </button>
            )}
          </div>
        </div>

        {productsQuery.isLoading && <p>Lade Produkte...</p>}
        {productsQuery.error && <p className="error">{(productsQuery.error as Error).message}</p>}

        <div className="product-grid">
          {productsQuery.data?.data.map((product) => (
            <article className="product-card" key={product._id}>
              <p className="category">{product.category}</p>
              <h3>{product.name}</h3>
              <p className="price">{product.price.toFixed(2)} EUR</p>
              <p>{product.description}</p>
              <p className="small">Stock: {product.stock}</p>
              <Link to={`/product/${product._id}`}>Details</Link>
            </article>
          ))}
        </div>

        {pagination && (
          <div className="pagination">
            <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
              Zurueck
            </button>
            <span>
              {offset + 1}-{Math.min(offset + limit, pagination.total)} von {pagination.total}
            </span>
            <button type="button" disabled={!pagination.has_next} onClick={() => setOffset(offset + limit)}>
              Weiter
            </button>
          </div>
        )}
      </section>

      {isCreateDialogOpen && (
        <div className="modal-backdrop" role="presentation" onClick={closeCreateDialog}>
          <section
            className="modal-card card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-product-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <h3 id="create-product-title">Neues Produkt erstellen</h3>
              <button type="button" onClick={closeCreateDialog}>
                Schliessen
              </button>
            </div>

            <form className="create-product-form" onSubmit={onSubmitCreateProduct}>
              <div className="form-two-col">
                <label>
                  SKU *
                  <input value={createSku} onChange={(event) => setCreateSku(event.target.value)} />
                </label>

                <label>
                  Name *
                  <input value={createName} onChange={(event) => setCreateName(event.target.value)} />
                </label>

                <label>
                  Kategorie *
                  <input
                    list="category-suggestions"
                    value={createCategory}
                    onChange={(event) => setCreateCategory(event.target.value)}
                  />
                </label>

                <label>
                  Preis *
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={createPrice}
                    onChange={(event) => setCreatePrice(event.target.value)}
                  />
                </label>

                <label>
                  Stock *
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={createStock}
                    onChange={(event) => setCreateStock(event.target.value)}
                  />
                </label>

                <label>
                  Tags (kommagetrennt)
                  <input
                    value={createTags}
                    onChange={(event) => setCreateTags(event.target.value)}
                    placeholder="gaming, premium, neu"
                  />
                </label>
              </div>

              <datalist id="category-suggestions">
                {categoriesQuery.data?.data.map((categoryOption) => (
                  <option key={categoryOption} value={categoryOption} />
                ))}
              </datalist>

              <label>
                Beschreibung *
                <textarea
                  value={createDescription}
                  onChange={(event) => setCreateDescription(event.target.value)}
                />
              </label>

              <div className="attribute-editor">
                <h4>Attribute</h4>
                <div className="attribute-row">
                  <input
                    type="text"
                    value={createAttributeKey}
                    onChange={(event) => setCreateAttributeKey(event.target.value)}
                    placeholder="Attributname"
                  />
                  <input
                    type="text"
                    value={createAttributeValue}
                    onChange={(event) => setCreateAttributeValue(event.target.value)}
                    placeholder="Wert (Text, Zahl, true/false)"
                  />
                  <button type="button" onClick={onAddCreateAttribute}>
                    Hinzufuegen
                  </button>
                </div>

                {Object.keys(createAttributes).length > 0 && (
                  <div className="chips">
                    {Object.entries(createAttributes).map(([key, value]) => (
                      <button
                        key={key}
                        type="button"
                        className="chip"
                        onClick={() => {
                          setCreateAttributes((prev) => {
                            const next = { ...prev };
                            delete next[key];
                            return next;
                          });
                        }}
                      >
                        {key}:{value} x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {createFormError && <p className="error">{createFormError}</p>}
              {createProductMutation.error && (
                <p className="error">{(createProductMutation.error as Error).message}</p>
              )}

              <div className="modal-actions">
                <button type="button" onClick={closeCreateDialog}>
                  Abbrechen
                </button>
                <button type="submit" className="primary-action" disabled={createProductMutation.isPending}>
                  {createProductMutation.isPending ? "Speichern..." : "Produkt speichern"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
};
