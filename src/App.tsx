import { useEffect, useMemo, useState } from 'react';
import { Octokit } from "@octokit/core";
import { throttling } from "@octokit/plugin-throttling";
import ReactPaginate from 'react-paginate';
import { useDebounce } from './hooks/useDebounce';
import { IResponse } from './types/searchReponse';
import './App.css';

function App() {
  const itemsPerPage = 10;

  // Set default states
  const [isLoading, setIsLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const debouncedSearchKeyword = useDebounce(searchKeyword);
  const [searchParams, setSearchParams] = useState({ keyword: '', pageNo: 1 });
  const [repositoriesData, setRepositoriesData] = useState<IResponse | null>(null);
  const [apiErrorMessage, setApiErrorMessage] = useState('');

  // Initialized Octokit and memoized it
  const octokit = useMemo(() => {
    //enable Throttling
    const MyOctokit = Octokit.plugin(throttling);
    return new MyOctokit({
      auth: process.env.REACT_APP_GITHUB_PERSONAL_ACCESS_TOKEN,
      throttle: {
        onRateLimit: (retryAfter: number, options: { method: string, url: string }, octokit: Octokit, retryCount: number) => {
          console.log(
            `Request quota exhausted for request ${options.method} ${options.url}`
          );

          if (retryCount < 1) {
            // only retries once
            octokit.log.info(`Retrying after ${retryAfter} seconds!`);
            return true;
          }
        },
        onSecondaryRateLimit: (retryAfter: number, options: { method: string, url: string }, octokit: Octokit) => {
          // does not retry, only logs a warning
          console.log(
            `SecondaryRateLimit detected for request ${options.method} ${options.url}`
          );
        },
      },
    });
  }, []);

  // Trigger fetch data on search params value change
  useEffect(() => {
    const fetchRepositoriesDataFromAPI = async () => {
      try {
        setIsLoading(true);
        const { data } = await octokit.request('GET /search/repositories{?q,sort,order,per_page,page}',
          {
            q: searchParams.keyword,
            page: searchParams.pageNo,
            per_page: itemsPerPage,
            sort: 'stars',
            order: 'desc',
          });

        setRepositoriesData(data);
      } catch (error) {
        setRepositoriesData(null);
        if (error instanceof Error) {
          // We don't need to show error for empty search keyword, other than that show error message
          if (!error.message.includes('"field":"q","code":"missing"')) {
            setApiErrorMessage(error.message);
          }
        } else {
          setApiErrorMessage(String(error));
        }
      } finally {
        setIsLoading(false);
      }
    }

    setApiErrorMessage('');
    fetchRepositoriesDataFromAPI();

  }, [octokit, searchParams]);

  // set search params on search keyword change
  useEffect(() => {
    if (debouncedSearchKeyword.length > 0) {
      setSearchParams({ keyword: debouncedSearchKeyword, pageNo: 1 });
    } else {
      setRepositoriesData(null);
    }
  }, [debouncedSearchKeyword]);

  const handlePageClick = (event: { selected: number }) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setSearchParams({ ...searchParams, pageNo: event.selected + 1 })
  };

  const handleReset = () => {
    setApiErrorMessage('');
    setSearchParams({ ...searchParams, pageNo: 1 })
  }

  const pageCount = repositoriesData?.total_count && repositoriesData?.total_count > 0 ? Math.ceil(repositoriesData?.total_count / itemsPerPage) : 0;

  return (
    <div className='app'>
      {isLoading && <div className='loading-bar'>Loading...</div>}
      <div className='container'>
        <h1>Search GitHub Repositories</h1>
        <input className='input' value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} placeholder='Repository name' autoFocus />
        <div className='result'>
          {apiErrorMessage.length > 0 && (
            <span>{apiErrorMessage} <button onClick={handleReset}>Back to Page 1</button></span>
          )}
          {
            repositoriesData?.items && repositoriesData?.items.length > 0 && (
              <span>Search Result:</span>
            )
          }
          {repositoriesData?.items?.map((item) =>
            <div key={item.id} className='result-item' onClick={() => window.open(item.html_url)}>
              <div className='top'>
                <div className='left'>
                  <div className='repo-name'>
                    <h2>{item.name}</h2>
                    <span>{item.visibility}</span>
                  </div>
                </div>
                <div className='right'>
                  {item.stargazers_count} Stars
                </div>
              </div>
              {item.description}
            </div>
          )}
        </div>
        {repositoriesData?.items && repositoriesData?.items?.length > 0 && (
          <div className='pagination'>
            <ReactPaginate
              breakLabel="..."
              nextLabel="next >"
              onPageChange={handlePageClick}
              forcePage={searchParams.pageNo - 1}
              pageRangeDisplayed={10}
              pageCount={pageCount}
              previousLabel="< previous"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
