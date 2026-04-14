import { FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAddReviewMutation, useProductDetailQuery } from "../hooks/queries";

export const ProductDetailPage = () => {
  const params = useParams<{ id: string }>();
  const productId = params.id ?? "";

  const productQuery = useProductDetailQuery(productId);
  const reviewMutation = useAddReviewMutation(productId);

  const [user, setUser] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user.trim() || !comment.trim()) {
      return;
    }

    await reviewMutation.mutateAsync({
      user: user.trim(),
      rating,
      comment: comment.trim()
    });

    setComment("");
  };

  if (productQuery.isLoading) {
    return <p>Lade Produktdetails...</p>;
  }

  if (productQuery.error) {
    return <p className="error">{(productQuery.error as Error).message}</p>;
  }

  if (!productQuery.data) {
    return <p>Kein Produkt gefunden.</p>;
  }

  const product = productQuery.data;

  return (
    <section className="detail-layout">
      <div className="card">
        <Link to="/">Zurueck zum Katalog</Link>
        <p className="category">{product.category}</p>
        <h2>{product.name}</h2>
        <p className="price">{product.price.toFixed(2)} EUR</p>
        <p>{product.description}</p>

        <h3>Attribute</h3>
        <dl className="attributes-list">
          {Object.entries(product.attributes).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="card">
        <h3>Reviews ({product.reviews.length})</h3>
        <div className="reviews-list">
          {product.reviews.length === 0 && <p>Noch keine Reviews vorhanden.</p>}
          {product.reviews.map((review, index) => (
            <article key={`${review.user}-${review.date}-${index}`} className="review-item">
              <div>
                <strong>{review.user}</strong>
                <span>{new Date(review.date).toLocaleDateString()}</span>
              </div>
              <p>Rating: {review.rating}/5</p>
              <p>{review.comment}</p>
            </article>
          ))}
        </div>

        <form onSubmit={onSubmit} className="review-form">
          <h4>Review hinzufuegen</h4>
          <input value={user} onChange={(event) => setUser(event.target.value)} placeholder="Name" />
          <select value={rating} onChange={(event) => setRating(Number(event.target.value))}>
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Wie war dein Eindruck?"
          />
          <button type="submit" disabled={reviewMutation.isPending}>
            {reviewMutation.isPending ? "Speichern..." : "Review speichern"}
          </button>
          {reviewMutation.error && <p className="error">{(reviewMutation.error as Error).message}</p>}
        </form>
      </div>
    </section>
  );
};
