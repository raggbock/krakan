import React from 'react'
import { render, screen } from '@testing-library/react'
import { SocialLinks } from './social-links'

describe('SocialLinks', () => {
  it('renders nothing when both inputs are null/empty', () => {
    const { container } = render(<SocialLinks instagram={null} facebook={null} />)
    expect(container).toBeEmptyDOMElement()
    const { container: c2 } = render(<SocialLinks instagram="" facebook="   " />)
    expect(c2).toBeEmptyDOMElement()
  })

  it('renders an Instagram link from a full URL', () => {
    render(<SocialLinks instagram="https://www.instagram.com/lillagrodans/" facebook={null} />)
    const link = screen.getByRole('link', { name: /Instagram/i })
    expect(link).toHaveAttribute('href', 'https://www.instagram.com/lillagrodans/')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('expands an @handle to an Instagram URL', () => {
    render(<SocialLinks instagram="@lillagrodans" facebook={null} />)
    expect(screen.getByRole('link', { name: /Instagram/i })).toHaveAttribute(
      'href',
      'https://instagram.com/lillagrodans',
    )
  })

  it('accepts a bare handle without @', () => {
    render(<SocialLinks instagram="lillagrodans" facebook={null} />)
    expect(screen.getByRole('link', { name: /Instagram/i })).toHaveAttribute(
      'href',
      'https://instagram.com/lillagrodans',
    )
  })

  it('rejects javascript: URLs', () => {
    const { container } = render(
      <SocialLinks instagram="javascript:alert(1)" facebook={null} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('rejects look-alike domains', () => {
    const { container } = render(
      <SocialLinks instagram="https://instagram.com.evil.com/foo" facebook={null} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('rejects handles with disallowed characters', () => {
    const { container } = render(
      <SocialLinks instagram="not a handle!" facebook={null} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a Facebook link from a full URL', () => {
    render(<SocialLinks instagram={null} facebook="https://facebook.com/lillagrodans" />)
    expect(screen.getByRole('link', { name: /Facebook/i })).toHaveAttribute(
      'href',
      'https://facebook.com/lillagrodans',
    )
  })

  it('accepts fb.com as a valid Facebook host', () => {
    render(<SocialLinks instagram={null} facebook="https://fb.com/lillagrodans" />)
    expect(screen.getByRole('link', { name: /Facebook/i })).toHaveAttribute(
      'href',
      'https://fb.com/lillagrodans',
    )
  })

  it('renders both links when both are present', () => {
    render(<SocialLinks instagram="lillagrodans" facebook="lillagrodans" />)
    expect(screen.getByRole('link', { name: /Instagram/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Facebook/i })).toBeInTheDocument()
  })
})
