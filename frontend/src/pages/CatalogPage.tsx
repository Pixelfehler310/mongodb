import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCategoriesQuery, useProductsQuery, useSeedMutation } from "../hooks/queries";
import { useFilterStore } from "../store/filters";

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

  const productsQuery = useProductsQuery();
  const categoriesQuery = useCategoriesQuery();
  const seedMutation = useSeedMutation();

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
          <label>
            Limit
            <select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={40}>40</option>
            </select>
          </label>
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
            <button
              type="button"
              disabled={!pagination.has_next}
              onClick={() => setOffset(offset + limit)}
            >
              Weiter
            </button>
          </div>
        )}
      </section>
    </section>
  );
};
