<?php

header('Access-Control-Allow-Origin: *');

/*
php endpoint for cytognomix/jbrowse page
March 2015
author: paul parsons
pparsons@uwo.ca
*/

//OMIM api key
$ApiKey = '';


//get the input from the client
$gene = $_GET['gene'];
$curl = curl_init();
                                      
//the url to send to
$omim_url = 'http://api.omim.org/api/entry/search?search=' . $gene . '&sort=score&include=geneMap&format=json';

curl_setopt_array($curl, array(
        CURLOPT_RETURNTRANSFER => 1,
        CURLOPT_URL => $omim_url,
        CURLOPT_CONNECTTIMEOUT => 0,
        CURLOPT_VERBOSE => true,
				CURLOPT_HTTPHEADER => array('ApiKey:' . $ApiKey)
    ));

$result = curl_exec($curl);

curl_close($curl);

//send the result to the client
echo $result;

        
        
        