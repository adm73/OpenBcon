import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { PublicSiteFooter, PublicSiteHeader } from '../components/PublicSiteChrome'
import { getSyncedNewsArticles, type NewsArticle } from '../data/news'
import { usePlatformConfig } from '../config/usePlatformConfig'
import { getPlatformDisplayName } from '../lib/platformBrand'
import { useLocale, useTranslation } from '../i18n'

function formatNewsDate(date: string, locale: string) {
  const timestamp = Date.parse(`${date}T12:00:00`)
  if (!Number.isFinite(timestamp)) return date

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(timestamp))
}

function articlePath(article: NewsArticle) {
  return `/news/${article.slug}`
}

function articleTitle(article: NewsArticle, t: ReturnType<typeof useTranslation>['t']) {
  return article.title || (article.translationKey
    ? t(`publicSite.news.articles.${article.translationKey}.title`)
    : article.slug)
}

function articleSummary(article: NewsArticle, t: ReturnType<typeof useTranslation>['t']) {
  return article.summary || (article.translationKey
    ? t(`publicSite.news.articles.${article.translationKey}.summary`)
    : '')
}

function articleSections(article: NewsArticle, t: ReturnType<typeof useTranslation>['t']) {
  if (article.sections?.length) return article.sections
  const articlePathPrefix = `publicSite.news.articles.${article.translationKey}`
  return (article.sectionKeys ?? []).map((sectionKey) => ({
    heading: t(`${articlePathPrefix}.sections.${sectionKey}.heading`),
    body: t(`${articlePathPrefix}.sections.${sectionKey}.body`),
  }))
}

function NewsArtwork({ article, featured = false }: { article: NewsArticle; featured?: boolean }) {
  if (article.imageUrl) {
    return (
      <div className={`public-news-art is-image${featured ? ' is-featured' : ''}`}>
        <img src={article.imageUrl} alt="" loading="lazy" />
      </div>
    )
  }

  return (
    <div className={`public-news-art is-${article.accent}${featured ? ' is-featured' : ''}`} aria-hidden="true">
      <span className="public-news-art-orbit" />
      <span className="public-news-art-mark">oB</span>
      <span className="public-news-art-index">{String(Math.max(1, article.slug.length % 99)).padStart(2, '0')}</span>
    </div>
  )
}

function NewsMeta({ article }: { article: NewsArticle }) {
  const { locale } = useLocale()
  const { t } = useTranslation()

  return (
    <div className="public-news-meta">
      <span>{t(`publicSite.news.categories.${article.category}`)}</span>
      <span>{formatNewsDate(article.date, locale)}</span>
      <span>{t('publicSite.news.readMinutes', { count: article.readMinutes })}</span>
    </div>
  )
}

function NewsCard({ article }: { article: NewsArticle }) {
  const { t } = useTranslation()

  return (
    <Link className="public-news-card" to={articlePath(article)}>
      <NewsArtwork article={article} />
      <div className="public-news-card-copy">
        <NewsMeta article={article} />
        <h3>{articleTitle(article, t)}</h3>
        <p>{articleSummary(article, t)}</p>
        <span className="public-news-card-link">{t('publicSite.news.readStory')} <span aria-hidden="true">→</span></span>
      </div>
    </Link>
  )
}

function NewsListItem({ article }: { article: NewsArticle }) {
  const { t } = useTranslation()

  return (
    <Link className="public-news-list-item" to={articlePath(article)}>
      <NewsArtwork article={article} />
      <div className="public-news-list-copy">
        <h2>{articleTitle(article, t)}</h2>
        <span>{t('publicSite.news.readMinutes', { count: article.readMinutes })}</span>
      </div>
    </Link>
  )
}

export function NewsListingPage() {
  const { config } = usePlatformConfig()
  const { t } = useTranslation()
  const platformName = getPlatformDisplayName(config)
  const articles = useMemo(() => getSyncedNewsArticles(config.dataSources), [config.dataSources])
  const [page, setPage] = useState(1)
  const pageSize = 10
  const pageCount = Math.max(1, Math.ceil(articles.length / pageSize))
  const visibleArticles = useMemo(
    () => articles.slice((page - 1) * pageSize, page * pageSize),
    [articles, page],
  )

  useEffect(() => {
    document.title = `${t('publicSite.news.pageTitle')} | ${platformName}`
  }, [platformName, t])

  return (
    <div className="landing-v2 public-news-page">
      <PublicSiteHeader />
      <main className="public-news-main public-news-list-page">
        <section className="public-news-list-heading">
          <h1>{t('publicSite.news.pageTitle')}</h1>
        </section>

        <section className="public-news-list-content" aria-label={t('publicSite.news.listLabel')}>
          {visibleArticles.map((article) => <NewsListItem article={article} key={article.slug} />)}
        </section>

        {pageCount > 1 && (
          <nav className="public-news-pagination" aria-label={t('publicSite.news.paginationLabel')}>
            <button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
              {t('publicSite.news.previous')}
            </button>
            <span>{t('publicSite.news.pageOf', { current: page, total: pageCount })}</span>
            <button type="button" disabled={page === pageCount} onClick={() => setPage((current) => current + 1)}>
              {t('publicSite.news.next')}
            </button>
          </nav>
        )}
      </main>
      <PublicSiteFooter />
    </div>
  )
}

export function NewsDetailPage() {
  const { slug } = useParams()
  const { config } = usePlatformConfig()
  const { t } = useTranslation()
  const platformName = getPlatformDisplayName(config)
  const articles = useMemo(() => getSyncedNewsArticles(config.dataSources), [config.dataSources])
  const article = articles.find((candidate) => candidate.slug === slug)

  useEffect(() => {
    if (article) {
      document.title = `${articleTitle(article, t)} | ${platformName}`
    }
  }, [article, platformName, t])

  if (!article) return <Navigate to="/404" replace />

  const relatedArticles = articles.filter((candidate) => candidate.slug !== article.slug).slice(0, 3)

  return (
    <div className="landing-v2 public-news-page">
      <PublicSiteHeader />
      <main className="public-news-detail-main">
        <Link className="public-news-back-link" to="/news">← {t('publicSite.news.backToNews')}</Link>
        <article className="public-news-detail">
          <div className="public-news-detail-heading">
            <NewsMeta article={article} />
            <h1>{articleTitle(article, t)}</h1>
            <p className="public-news-detail-summary">{articleSummary(article, t)}</p>
          </div>
          <NewsArtwork article={article} featured />
          <div className="public-news-body">
            {articleSections(article, t).map((section) => (
              <section key={section.heading}>
                <h2>{section.heading}</h2>
                <p>{section.body}</p>
              </section>
            ))}
          </div>
        </article>
        <section className="public-news-related" aria-labelledby="public-news-related-title">
          <div className="public-news-section-heading">
            <div>
              <p className="public-news-eyebrow">{t('publicSite.news.latest')}</p>
              <h2 id="public-news-related-title">{t('publicSite.news.moreStories')}</h2>
            </div>
          </div>
          <div className="public-news-grid">
            {relatedArticles.map((relatedArticle) => <NewsCard article={relatedArticle} key={relatedArticle.slug} />)}
          </div>
        </section>
      </main>
      <PublicSiteFooter />
    </div>
  )
}
