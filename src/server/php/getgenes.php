<?php

	header('Access-Control-Allow-Origin: *');

	$chr = filter_input(INPUT_GET, 'chr', FILTER_SANITIZE_STRING, FILTER_FLAG_NO_ENCODE_QUOTES);
	$start = filter_input(INPUT_GET, 'start', FILTER_SANITIZE_STRING, FILTER_FLAG_NO_ENCODE_QUOTES);
	$stop = filter_input(INPUT_GET, 'stop', FILTER_SANITIZE_STRING, FILTER_FLAG_NO_ENCODE_QUOTES);

	$id_url = "http://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=gene&term=" 
		.$chr."[chr]+AND+"
		.$start."[CHRPOS]:"
		.$stop."[CHRPOS]+AND+human[ORGN]&retmax=200";
		
	$res = simplexml_load_string(file_get_contents($id_url))->IdList->Id;
	//print_r($res);
 	$num_results = sizeof($res);
	
	$id_list = "";
	for($i = 0; $i < $num_results; $i++) {
		$id_list .= (string)$res[$i] . ',';
	}
	
	$id_list = rtrim($id_list, ",");
	
	$gene_url = "http://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gene&id=" . $id_list;
	$gene_results = simplexml_load_string(file_get_contents($gene_url));

    
	$res = $gene_results->DocumentSummarySet->DocumentSummary;
	
	class Result {
		public $symbol = "";
		public $cytloc = "";
		public $desc = "";
		public $synonyms = "";
		public $id = "";
		public $nc = "";
		public $start = "";
		public $end = "";
	}
	
	$results = [];
	
	for($j = 0; $j < $num_results; $j++) {
		$gene = $res[$j];
		
		$resobj = new Result();
		$resobj-> symbol = (string)$gene-> Name;
		$resobj-> cytloc = (string)$gene-> MapLocation;
		$resobj-> desc = (string)$gene-> Description;
		$resobj-> synonyms = (string)$gene-> OtherAliases;
		$resobj-> id = (string)$gene-> attributes()->uid;
		$resobj-> start = (string)$gene-> GenomicInfo->GenomicInfoType->ChrStart;
		$resobj-> end = (string)$gene-> GenomicInfo->GenomicInfoType->ChrStop;
		$resobj-> nc = (string)$gene-> GenomicInfo->GenomicInfoType->ChrAccVer;
		
		array_push($results, $resobj);
	}
	
	echo json_encode($results);
	
?>