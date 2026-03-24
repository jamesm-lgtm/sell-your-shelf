export async function GET() {
  return Response.json({
    applinks: {
      apps: [],
      details: [
        {
          appID: '8T8DTZ5WLY.com.anonymous.SellYourShelf',
          paths: ['/listing/*', '/*']
        }
      ]
    }
  })
}