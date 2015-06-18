
# angular-geneview-vis 

Interactive visualization for relative gene locations

Live Demo of latest code [HERE](http://104.236.236.182/angular-geneview-vis/)
# Development

Start web server for development:
Directory must contain /soscip/api/ directory

```
php -S 127.0.0.1:9090 -t .
```

# Build

To build the project, run gulp in the root directory: `gulp dev` or `gulp release`. 

# Sample API calls

Get genes based on chromosome location

`http://localhost:9090/soscip/api/getgenes.php?chr=5&start=73640001&stop=77960000`

Get phenotypes from genes

`http://localhost:9090/soscip/api/gen2phen.php?gene=CCNB1`
