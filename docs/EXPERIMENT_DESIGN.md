# PoC evaluation design

## Default conclusion

The default `operations_only` mode validates schedule collection, review, post
generation, approval, publishing, tracking, and recovery. It does not estimate
causal sales lift.

Raw featured-day versus non-featured-day sales are not used because operational
selection creates directional selection bias.

## Randomized holdout mode

`randomized_holdout` pairs eligible therapists with similar operational
characteristics and deterministically randomizes one member to treatment and
the other to control. Each post stores both groups.

Sales differences are displayed only when both randomized treatment and control
observations exist. Results remain exploratory until each comparison group has
at least 30 observations.

## Variant allocation

Variants are balanced within each store and weekday. Small PoC samples are still
not suitable for declaring a winning variant.

## Click quality

Tracking records crawler traffic but excludes matching User-Agents from
analytics. Only `counted = true` clicks are aggregated.

## Gross profit

When actual therapist payment is unavailable, gross profit uses the configured
default payment rate and is presented as an estimate.
