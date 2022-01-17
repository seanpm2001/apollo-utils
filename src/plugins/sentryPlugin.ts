import * as Sentry from '@sentry/node';
import { ApolloError } from 'apollo-client';
import { ApolloServerPlugin } from 'apollo-server-plugin-base';

/**
 * Plugin for handling errors.
 * Logs the original error to console (for cloudwatch)
 * and Sentry.
 * This is only invoked if the graphql execution actually
 * started, so it will not send errors that occurred while
 * before the query could start (e.g. syntax error in graphql
 * query sent by client)
 */
//Copied from https://blog.sentry.io/2020/07/22/handling-graphql-errors-using-sentry
export const sentryPlugin: ApolloServerPlugin = {
  async requestDidStart() {
    /* Within this returned object, define functions that respond
                 to request-specific lifecycle events. */
    return {
      async didEncounterErrors(ctx) {
        // If we couldn't parse the operation, don't
        // do anything here
        if (!ctx.operation) {
          return;
        }

        for (const err of ctx.errors) {
          // Only report internal server errors,
          // all errors extending ApolloError should be user-facing
          if (err instanceof ApolloError) {
            continue;
          }

          // Add scoped report details and send to Sentry
          Sentry.withScope((scope) => {
            // Annotate whether failing operation was query/mutation/subscription
            scope.setTag('kind', ctx.operation.operation);

            // Log query and variables as extras (make sure to strip out sensitive data!)
            scope.setExtra('query', ctx.request.query);
            scope.setExtra('variables', JSON.stringify(ctx.request.variables));

            if (err.path) {
              // We can also add the path as breadcrumb
              scope.addBreadcrumb({
                category: 'query-path',
                message: err.path.join(' > '),
                level: Sentry.Severity.Debug,
              });
            }

            //logs error to cloudwatch and sentry
            console.log(err);
            Sentry.captureException(err);
          });
        }
      },
    };
  },
};