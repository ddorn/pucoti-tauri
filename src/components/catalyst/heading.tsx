import clsx from 'clsx'

type HeadingProps = { level?: 1 | 2 | 3 | 4 | 5 | 6 } & React.ComponentPropsWithoutRef<
  'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
>


const styles = {
  h1: 'text-6xl font-bold ',
  h2: 'text-4xl font-bold',
  h3: 'text-3xl font-bold',
  h4: 'text-2xl font-bold',
  h5: 'text-xl font-bold',
  h6: 'text-lg font-bold',
}

export function Heading({ className, level = 1, ...props }: HeadingProps) {
  const Element: `h${typeof level}` = `h${level}`

  const textShadow = level < 3 ? `0px 3px 1px var(--color-accent)` : undefined

  return (
    <Element
      {...props}
      className={clsx(className, styles[`h${level}`], 'text-zinc-950 dark:text-white')}
      style={{ textShadow }}
    />
  )
}

export function Subheading({ className, level = 2, ...props }: HeadingProps) {
  const Element: `h${typeof level}` = `h${level}`

  return (
    <Element
      {...props}
      className={clsx(className, 'text-base/7 font-semibold text-zinc-950 sm:text-sm/6 dark:text-white')}
    />
  )
}
